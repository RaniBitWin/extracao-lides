import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { geoapifyClient, GeoapifyPauseError } from "../geoapify/geoapify.client.js";
import { geoapifyService } from "../geoapify/geoapify.service.js";
import type { GeoapifyPlaceSummary } from "../geoapify/geoapify.types.js";
import { runStore } from "../runs/run-store.js";
import { sheetsService } from "../sheets/sheets.service.js";
import type {
  CollectedPlace,
  CollectionDecisionInput,
  CollectionInput,
  CollectionResponse,
  CollectionRunState,
  PauseReason,
} from "./collection.types.js";

type LoggerLike = {
  info: (payload: object, message?: string) => void;
  warn: (payload: object, message?: string) => void;
  error: (payload: object, message?: string) => void;
};

const RADIUS_MULTIPLIERS = [1, 2, 4];
const REJECTED_SEGMENT_TERMS = [
  "ultragaz",
  "gas",
  "gás",
  "brecho",
  "brechó",
  "bazar",
  "mercado",
  "mini mercado",
  "supermercado",
  "sacolao",
  "sacolão",
  "farmacia",
  "farmácia",
  "posto",
  "loja",
];

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeComparable(value: string) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const STATE_ALIASES: Record<string, string> = {
  ac: "acre",
  al: "alagoas",
  ap: "amapa",
  am: "amazonas",
  ba: "bahia",
  ce: "ceara",
  df: "distrito federal",
  es: "espirito santo",
  go: "goias",
  ma: "maranhao",
  mt: "mato grosso",
  ms: "mato grosso do sul",
  mg: "minas gerais",
  pa: "para",
  pb: "paraiba",
  pr: "parana",
  pe: "pernambuco",
  pi: "piaui",
  rj: "rio de janeiro",
  rn: "rio grande do norte",
  rs: "rio grande do sul",
  ro: "rondonia",
  rr: "roraima",
  sc: "santa catarina",
  sp: "sao paulo",
  se: "sergipe",
  to: "tocantins",
};

function normalizeStateComparable(value: string) {
  const normalized = normalizeComparable(value);
  return STATE_ALIASES[normalized] ?? normalized;
}

function normalizeCoordinate(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return Number(value.toFixed(6));
}

function isPizzaSearch(searchTerm: string) {
  const normalizedTerm = normalizeComparable(searchTerm);
  return (
    normalizedTerm.includes("pizza") ||
    normalizedTerm.includes("pizzaria") ||
    normalizedTerm.includes("pizzarias")
  );
}

function isBarbershopSearch(searchTerm: string) {
  const normalizedTerm = normalizeComparable(searchTerm);
  return (
    normalizedTerm.includes("barbearia") ||
    normalizedTerm.includes("barbearias") ||
    normalizedTerm.includes("barber") ||
    normalizedTerm.includes("barbeiro")
  );
}

function getEffectiveGeoapifyCategory(params: {
  searchTerm: string;
  currentCategory: string | null;
  fallbackCategory: string;
}) {
  if (isPizzaSearch(params.searchTerm)) {
    return {
      category: "catering.restaurant",
      categoryLabel: "pizzarias",
      trustedCategory: true,
      relevanceTerms: ["pizza", "pizzaria", "pizzarias"],
      fallbackReason: null,
    };
  }

  if (params.currentCategory && params.currentCategory !== "commercial") {
    return {
      category: params.currentCategory,
      categoryLabel: params.currentCategory,
      trustedCategory: true,
      relevanceTerms: [],
      fallbackReason: null,
    };
  }

  return {
    category: params.fallbackCategory,
    categoryLabel: params.fallbackCategory,
    trustedCategory: false,
    relevanceTerms: [],
    fallbackReason: "categoria_generica_ou_ausente_no_estado_da_execucao",
  };
}

export class CollectionService {
  async startCollection(
    input: CollectionInput,
    logger: LoggerLike,
  ): Promise<CollectionResponse> {
    logger.info(
      {
        searchTerm: input.searchTerm,
        city: input.city,
        state: input.state,
        maxResults: input.maxResults,
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
      },
      "Iniciando execucao real com Geoapify",
    );

    if (!env.GEOAPIFY_API_KEY) {
      throw new AppError(
        "GEOAPIFY_API_KEY nao configurada.",
        500,
        "MISSING_GEOAPIFY_API_KEY",
      );
    }

    const initialRadius = env.GEOAPIFY_SEARCH_RADIUS_METERS * RADIUS_MULTIPLIERS[0];
    const run: CollectionRunState = {
      runId: randomUUID(),
      searchTerm: input.searchTerm,
      city: input.city,
      state: input.state,
      maxResults: input.maxResults,
      spreadsheetId: input.spreadsheetId,
      sheetName: input.sheetName,
      source: "geoapify",
      status: "running",
      pauseReason: null,
      pauseDecision: null,
      failureType: null,
      canResume: false,
      message: "Execucao criada.",
      nextOffset: 0,
      pageSize: Math.min(env.GEOAPIFY_PAGE_SIZE, input.maxResults),
      radiusStageIndex: 0,
      currentRadiusMeters: initialRadius,
      estimatedCreditsUsed: 0,
      estimatedCreditsLimit: env.GEOAPIFY_DAILY_CREDIT_LIMIT,
      estimatedCreditsRemaining: env.GEOAPIFY_DAILY_CREDIT_LIMIT,
      estimatedCreditsGeocoding: 0,
      estimatedCreditsSearch: 0,
      estimatedCreditsDetails: 0,
      totalCollected: 0,
      totalInserted: 0,
      totalIgnored: 0,
      totalWithError: 0,
      recentItems: [],
      seenPlaceIds: [],
      geoapifyCategory: null,
      geoapifyCategoryLabel: null,
      geoapifyCategoryTrusted: false,
      geoapifyRelevanceTerms: [],
      locationQuery: null,
      resolvedLocation: null,
      latitude: null,
      longitude: null,
      startedAt: nowIso(),
      updatedAt: nowIso(),
      finishedAt: null,
    };

    await runStore.save(run);

    return this.execute(run, logger);
  }

  async resumeCollection(runId: string, logger: LoggerLike): Promise<CollectionResponse> {
    const run = await runStore.get(runId);

    if (run.status !== "paused") {
      throw new AppError(
        `A execucao ${runId} nao esta pausada.`,
        400,
        "RUN_NOT_PAUSED",
      );
    }

    run.status = "running";
    run.pauseReason = null;
    run.failureType = null;
    run.canResume = false;
    run.message = "Execucao retomada pelo usuario.";
    run.updatedAt = nowIso();
    await runStore.save(run);

    return this.execute(run, logger);
  }

  async getRun(runId: string) {
    return runStore.get(runId);
  }

  async savePauseDecision(input: CollectionDecisionInput) {
    const run = await runStore.get(input.runId);

    if (run.status !== "paused") {
      throw new AppError(
        `A execucao ${input.runId} nao esta pausada.`,
        400,
        "RUN_NOT_PAUSED",
      );
    }

    run.pauseDecision = input.decision;
    run.updatedAt = nowIso();
    run.message =
      input.decision === "continue_next_day"
        ? "Execucao encerrada por agora. Pode ser retomada no dia seguinte."
        : "Execucao aguardando upgrade manual do plano Geoapify.";

    await runStore.save(run);
    return run;
  }

  private async execute(
    run: CollectionRunState,
    logger: LoggerLike,
  ): Promise<CollectionResponse> {
    try {
      if (run.latitude === null || run.longitude === null) {
        logger.info(
          {
            runId: run.runId,
            city: run.city,
            state: run.state,
            searchTerm: run.searchTerm,
          },
          "Busca inicial: resolvendo categoria e localidade",
        );

        const resolvedQuery = await geoapifyService.resolveQuery({
          searchTerm: run.searchTerm,
          city: run.city,
          state: run.state,
        }, logger);

        const effectiveCategory = getEffectiveGeoapifyCategory({
          searchTerm: run.searchTerm,
          currentCategory: resolvedQuery.category,
          fallbackCategory: resolvedQuery.category,
        });

        run.geoapifyCategory = effectiveCategory.category;
        run.geoapifyCategoryLabel = isPizzaSearch(run.searchTerm)
          ? "pizzarias"
          : resolvedQuery.categoryLabel;
        run.geoapifyCategoryTrusted = isPizzaSearch(run.searchTerm)
          ? true
          : resolvedQuery.trustedCategory;
        run.geoapifyRelevanceTerms = isPizzaSearch(run.searchTerm)
          ? ["pizza", "pizzaria", "pizzarias"]
          : resolvedQuery.relevanceTerms;
        run.locationQuery = resolvedQuery.locationQuery;
        run.resolvedLocation = resolvedQuery.resolvedAddress;
        run.latitude = resolvedQuery.lat;
        run.longitude = resolvedQuery.lon;
        run.currentRadiusMeters = resolvedQuery.radiusMeters;
        this.consumeCredits(run, "geocoding", 1);
        run.message = `Local resolvido: ${resolvedQuery.resolvedAddress}.`;
        logger.info(
          {
            runId: run.runId,
            searchTerm: run.searchTerm,
            initialResolvedCategory: resolvedQuery.initialCategory,
            inferredCategory: run.geoapifyCategory,
            categoryLabel: run.geoapifyCategoryLabel,
            trustedCategory: run.geoapifyCategoryTrusted,
            relevanceTerms: run.geoapifyRelevanceTerms,
            fallbackReason: resolvedQuery.fallbackReason ?? effectiveCategory.fallbackReason,
            autoCorrectedCategory: resolvedQuery.autoCorrectedCategory,
          },
          "Busca inicial: categoria inferida",
        );
        await this.persist(run, logger, "checkpoint-inicial");
      }

      while (run.totalCollected < run.maxResults) {
        if (run.estimatedCreditsUsed >= run.estimatedCreditsLimit) {
          return this.pauseRun(
            run,
            "daily_credit_limit_estimated",
            "Limite diario estimado de creditos atingido antes da proxima busca.",
            logger,
          );
        }

        const remaining = run.maxResults - run.totalCollected;
        const pageLimit = Math.min(run.pageSize, remaining);

        logger.info(
          {
            runId: run.runId,
            offset: run.nextOffset,
            categoryUsed: run.geoapifyCategory ?? "commercial",
            radiusMeters: run.currentRadiusMeters,
            pageLimit,
            estimatedCreditsUsed: run.estimatedCreditsUsed,
            estimatedCreditsRemaining: run.estimatedCreditsRemaining,
            estimatedCreditsSearch: run.estimatedCreditsSearch,
            estimatedCreditsDetails: run.estimatedCreditsDetails,
          },
          "Paginacao/expansao: buscando pagina na Geoapify",
        );

        let page;
        const effectiveCategory = getEffectiveGeoapifyCategory({
          searchTerm: run.searchTerm,
          currentCategory: run.geoapifyCategory,
          fallbackCategory: "commercial",
        });
        const validatedEffectiveCategory = geoapifyService.validateCategorySelection({
          searchTerm: run.searchTerm,
          inferredCategory: effectiveCategory.category,
          label: run.geoapifyCategoryLabel ?? effectiveCategory.categoryLabel,
          relevanceTerms: run.geoapifyRelevanceTerms,
          trustedCategory: run.geoapifyCategoryTrusted,
          fallbackCategory: "commercial",
        });

        if (run.geoapifyCategory !== validatedEffectiveCategory.category) {
          run.geoapifyCategory = validatedEffectiveCategory.category;
        }

        try {
          logger.info(
            {
              runId: run.runId,
              searchTerm: run.searchTerm,
              initialInferredCategory: validatedEffectiveCategory.initialCategory,
              finalCategorySentToGeoapify: validatedEffectiveCategory.category,
              fallbackReason:
                validatedEffectiveCategory.fallbackReason ?? effectiveCategory.fallbackReason,
              autoCorrectedCategory: validatedEffectiveCategory.autoCorrectedCategory,
            },
            "Paginacao/expansao: categoria final da consulta Geoapify",
          );

          page = await geoapifyClient.searchPlacesPage({
            category: validatedEffectiveCategory.category,
            lat: run.latitude ?? 0,
            lon: run.longitude ?? 0,
            radiusMeters: run.currentRadiusMeters,
            offset: run.nextOffset,
            limit: pageLimit,
          });
        } catch (error) {
          if (error instanceof GeoapifyPauseError) {
            return this.pauseFromGeoapifyError(run, error, logger);
          }

          throw error;
        }

        this.consumeCredits(run, "search", page.requestCredits);
        const candidates = this.prepareCandidates(page.items, run, logger);
        run.message = `Busca retornou ${page.items.length} itens; ${candidates.length} candidato(s) novos.`;
        await this.persist(run, logger, "checkpoint-busca");

        if (candidates.length === 0) {
          const expanded = await this.tryExpandRadius(run, logger);

          if (!expanded) {
            return this.completeRun(
              run,
              "Execucao concluida sem mais resultados disponiveis para expandir.",
              logger,
            );
          }

          continue;
        }

        const pageItems: CollectedPlace[] = [];
        let processedThisPage = 0;
        let pauseReason: PauseReason = null;
        let pauseMessage = "";

        for (const candidate of candidates) {
          if (run.estimatedCreditsUsed + 1 > run.estimatedCreditsLimit) {
            pauseReason = "daily_credit_limit_estimated";
            pauseMessage =
              "A execucao foi pausada para evitar ultrapassar o limite diario estimado de creditos.";
            break;
          }

          try {
            logger.info(
              {
                runId: run.runId,
                placeId: candidate.placeId,
                estimatedCreditsDetails: run.estimatedCreditsDetails + 1,
              },
              "Transformacao: enriquecendo lead com Place Details",
            );

            const details = await geoapifyClient.getPlaceDetails(candidate.placeId);
            this.consumeCredits(run, "details", 1);

            const lead = this.buildLead(run, candidate, details);
            pageItems.push(lead);
            run.seenPlaceIds.push(candidate.placeId);
            processedThisPage += 1;
          } catch (error) {
            if (error instanceof GeoapifyPauseError) {
              pauseReason =
                error.kind === "rate_limit"
                  ? "geoapify_rate_limit"
                  : "geoapify_quota_exceeded";
              pauseMessage = error.message;
              break;
            }

            processedThisPage += 1;
            run.totalWithError += 1;
            run.seenPlaceIds.push(candidate.placeId);
            pageItems.push(
              this.buildLead(run, candidate, {
                phone: "",
                website: "",
                address: candidate.address,
                neighborhood: candidate.neighborhood,
                city: candidate.city,
                state: candidate.state,
                postcode: candidate.postcode,
                latitude: candidate.latitude,
                longitude: candidate.longitude,
              }, "erro"),
            );
            logger.warn(
              {
                runId: run.runId,
                placeId: candidate.placeId,
                error,
              },
              "Transformacao: falha ao enriquecer lead; registrando com status erro",
            );
          }
        }

        if (pageItems.length > 0) {
          logger.info(
            {
              runId: run.runId,
              rows: pageItems.length,
              spreadsheetId: run.spreadsheetId,
              sheetName: run.sheetName,
            },
            "Gravacao: enviando lote para o Google Sheets",
          );

          const writeResult = await sheetsService.writeRows(
            {
              spreadsheetId: run.spreadsheetId,
              sheetName: run.sheetName,
              searchTerm: run.searchTerm,
              rows: pageItems,
            },
            logger,
          );

          run.totalCollected += pageItems.length;
          run.totalInserted += writeResult.totalInserted;
          run.totalIgnored += writeResult.totalIgnored;
          run.totalWithError += writeResult.totalWithError;
          run.recentItems = pageItems.slice(-10);
        }

        run.nextOffset += processedThisPage;
        await this.persist(run, logger, "checkpoint-pos-gravacao");

        if (pauseReason) {
          return this.pauseRun(run, pauseReason, pauseMessage, logger);
        }

        if (page.items.length < pageLimit) {
          const expanded = await this.tryExpandRadius(run, logger);

          if (!expanded) {
            return this.completeRun(
              run,
              "Execucao concluida sem mais resultados disponiveis.",
              logger,
            );
          }
        }
      }

      return this.completeRun(
        run,
        "Execucao concluida com o limite maximo de resultados solicitado.",
        logger,
      );
    } catch (error) {
      logger.error(
        {
          runId: run.runId,
          err: error,
        },
        "Falha na execucao da coleta",
      );

      run.status = "failed";
      run.canResume = false;
      run.failureType =
        error instanceof AppError && error.code === "GEOAPIFY_AUTH_ERROR"
          ? "auth_error"
          : "integration_error";
      run.message =
        error instanceof Error ? error.message : "Falha inesperada na execucao.";
      run.updatedAt = nowIso();
      run.finishedAt = nowIso();
      await runStore.save(run);

      throw error;
    }
  }

  private prepareCandidates(
    items: GeoapifyPlaceSummary[],
    run: CollectionRunState,
    logger: LoggerLike,
  ) {
    const requestedCity = normalizeComparable(run.city);
    const requestedState = normalizeStateComparable(run.state);
    const accepted: GeoapifyPlaceSummary[] = [];
    let rejectedByRelevance = 0;

    for (const item of items) {
      if (run.seenPlaceIds.includes(item.placeId)) {
        logger.info(
          {
            runId: run.runId,
            placeId: item.placeId,
            name: item.name,
            reason: "place_id_ja_processado",
          },
          "Transformacao: lead rejeitado",
        );
        continue;
      }

      const relevance = this.evaluateRelevance(item, run, requestedCity, requestedState);

      if (!relevance.accepted) {
        rejectedByRelevance += 1;
        logger.info(
          {
            runId: run.runId,
            placeId: item.placeId,
            name: item.name,
            inferredCategory: run.geoapifyCategory,
            reason: relevance.reason,
          },
          "Transformacao: lead rejeitado",
        );
        continue;
      }

      logger.info(
        {
          runId: run.runId,
          placeId: item.placeId,
          name: item.name,
          inferredCategory: run.geoapifyCategory,
          reason: relevance.reason,
        },
        "Transformacao: lead aceito",
      );
      accepted.push(item);
    }

    logger.info(
      {
        runId: run.runId,
        categoryUsed: run.geoapifyCategory,
        acceptedCount: accepted.length,
        rejectedByRelevance,
      },
      "Transformacao: resumo de relevancia da pagina",
    );

    return accepted.sort((left, right) => {
        const leftScore = this.matchScore(left, requestedCity, requestedState);
        const rightScore = this.matchScore(right, requestedCity, requestedState);
        return rightScore - leftScore;
      });
  }

  private evaluateRelevance(
    item: GeoapifyPlaceSummary,
    run: CollectionRunState,
    requestedCity: string,
    requestedState: string,
  ) {
    const itemCity = normalizeComparable(item.city);
    const itemState = normalizeStateComparable(item.state);
    const name = normalizeComparable(item.name);
    const categories = item.categories.map((category) => normalizeComparable(category));
    const inferredCategory = normalizeComparable(run.geoapifyCategory ?? "");
    const trustedCategory = run.geoapifyCategoryTrusted;
    const relevanceTerms = run.geoapifyRelevanceTerms.map((term) =>
      normalizeComparable(term),
    );
    const sameState = !requestedState || itemState === requestedState;
    const sameCity = !requestedCity || itemCity === requestedCity;
    const categoryMatches = categories.some(
      (itemCategory) =>
        itemCategory === inferredCategory || itemCategory.startsWith(`${inferredCategory}.`),
    );
    const nameMatches = relevanceTerms.some(
      (term) => term.length >= 4 && name.includes(term),
    );
    const isBlacklistedSegment = REJECTED_SEGMENT_TERMS.some((term) =>
      name.includes(normalizeComparable(term)),
    );
    const isPizzaSearch = relevanceTerms.some((term) => term.includes("pizza"));
    const isBarbershopQuery = isBarbershopSearch(run.searchTerm);
    const barbershopNameMatches = ["barbearia", "barbearias", "barber", "barbeiro"].some(
      (term) => name.includes(normalizeComparable(term)),
    );
    const genericBeautyNameMatches = [
      "cabeleireiro",
      "cabeleireira",
      "salao",
      "saloes",
      "salão",
      "salões",
      "beauty",
    ].some((term) => name.includes(normalizeComparable(term)));
    const hasFoodCategory = categories.some(
      (itemCategory) =>
        itemCategory.startsWith("catering") ||
        itemCategory.startsWith("accommodation.restaurant"),
    );

    if (!sameState) {
      return {
        accepted: false,
        reason: "estado_incompativel",
      };
    }

    if (isBlacklistedSegment) {
      return {
        accepted: false,
        reason: "segmento_incompativel_com_o_termo",
      };
    }

    if (isPizzaSearch) {
      if (sameCity && nameMatches) {
        return {
          accepted: true,
          reason: "nome_aderente_a_pizza_e_cidade_compativel",
        };
      }

      if (nameMatches && hasFoodCategory) {
        return {
          accepted: true,
          reason: "nome_aderente_a_pizza_e_categoria_de_alimentacao",
        };
      }

      return {
        accepted: false,
        reason: "busca_pizza_sem_aderencia_forte",
      };
    }

    if (isBarbershopQuery) {
      if (sameCity && barbershopNameMatches) {
        return {
          accepted: true,
          reason: "nome_aderente_a_barbearia_e_cidade_compativel",
        };
      }

      if (barbershopNameMatches && categoryMatches) {
        return {
          accepted: true,
          reason: "nome_aderente_a_barbearia_e_categoria_compativel",
        };
      }

      if (genericBeautyNameMatches) {
        return {
          accepted: false,
          reason: "nome_generico_de_beleza_sem_aderencia_a_barbearia",
        };
      }

      if (sameCity && categoryMatches) {
        return {
          accepted: true,
          reason: "fallback_controlado_barbearia_por_categoria_e_cidade",
        };
      }

      return {
        accepted: false,
        reason: "categoria_de_beleza_sem_nome_aderente_a_barbearia",
      };
    }

    if (trustedCategory) {
      if (categoryMatches) {
        return {
          accepted: true,
          reason: sameCity ? "categoria_especifica_e_cidade_compativel" : "categoria_especifica",
        };
      }

      if (sameCity && nameMatches) {
        return {
          accepted: true,
          reason: "nome_aderente_ao_termo_e_cidade_compativel",
        };
      }

      return {
        accepted: false,
        reason: "fora_da_categoria_especifica",
      };
    }

    if (sameCity && nameMatches) {
      return {
        accepted: true,
        reason: "fallback_controlado_por_nome_e_cidade",
      };
    }

    return {
      accepted: false,
      reason: "fallback_sem_relevancia_suficiente",
    };
  }

  private matchScore(
    item: GeoapifyPlaceSummary,
    requestedCity: string,
    requestedState: string,
  ) {
    let score = 0;

    if (normalizeComparable(item.city) === requestedCity) {
      score += 2;
    }

    if (normalizeStateComparable(item.state) === requestedState) {
      score += 1;
    }

    return score;
  }

  private buildLead(
    run: CollectionRunState,
    summary: GeoapifyPlaceSummary,
    details: {
      phone: string;
      website: string;
      address: string;
      neighborhood: string;
      city: string;
      state: string;
      postcode: string;
      latitude: number | null;
      longitude: number | null;
    },
    status: CollectedPlace["status"] = "coletado",
  ): CollectedPlace {
    const address = normalizeText(details.address || summary.address);
    const city = normalizeText(details.city || summary.city || run.city);
    const state = normalizeText(details.state || summary.state || run.state);

    return {
      placeId: summary.placeId,
      runId: run.runId,
      collectedAt: nowIso(),
      searchTerm: normalizeText(run.searchTerm),
      name: normalizeText(summary.name),
      address,
      neighborhood: normalizeText(details.neighborhood || summary.neighborhood),
      city,
      state,
      postcode: normalizeText(details.postcode || summary.postcode),
      phone: normalizeText(details.phone),
      website: normalizeText(details.website),
      latitude: normalizeCoordinate(details.latitude ?? summary.latitude),
      longitude: normalizeCoordinate(details.longitude ?? summary.longitude),
      source: "geoapify",
      status,
    };
  }

  private consumeCredits(
    run: CollectionRunState,
    step: "geocoding" | "search" | "details",
    amount: number,
  ) {
    run.estimatedCreditsUsed += amount;
    run.estimatedCreditsRemaining = Math.max(
      0,
      run.estimatedCreditsLimit - run.estimatedCreditsUsed,
    );

    if (step === "geocoding") {
      run.estimatedCreditsGeocoding += amount;
    }

    if (step === "search") {
      run.estimatedCreditsSearch += amount;
    }

    if (step === "details") {
      run.estimatedCreditsDetails += amount;
    }
  }

  private async persist(run: CollectionRunState, logger: LoggerLike, stage: string) {
    run.updatedAt = nowIso();
    await runStore.save(run);
    logger.info(
      {
        runId: run.runId,
        stage,
        nextOffset: run.nextOffset,
        totalCollected: run.totalCollected,
        totalInserted: run.totalInserted,
        estimatedCreditsUsed: run.estimatedCreditsUsed,
      },
      "Checkpoint salvo",
    );
  }

  private async tryExpandRadius(run: CollectionRunState, logger: LoggerLike) {
    const nextStageIndex = run.radiusStageIndex + 1;

    if (nextStageIndex >= RADIUS_MULTIPLIERS.length) {
      return false;
    }

    run.radiusStageIndex = nextStageIndex;
    run.currentRadiusMeters =
      env.GEOAPIFY_SEARCH_RADIUS_METERS * RADIUS_MULTIPLIERS[nextStageIndex];
    run.nextOffset = 0;
    run.message = `Expandindo busca para raio de ${run.currentRadiusMeters} metros.`;
    await this.persist(run, logger, "checkpoint-expansao");

    logger.info(
      {
        runId: run.runId,
        radiusStageIndex: run.radiusStageIndex,
        currentRadiusMeters: run.currentRadiusMeters,
      },
      "Paginacao/expansao: aumentando raio da busca",
    );

    return true;
  }

  private async completeRun(
    run: CollectionRunState,
    message: string,
    logger: LoggerLike,
  ) {
    if (run.totalCollected === 0) {
      await sheetsService.writeRows(
        {
          spreadsheetId: run.spreadsheetId,
          sheetName: run.sheetName,
          searchTerm: run.searchTerm,
          rows: [],
        },
        logger,
      );
    }

    run.status = "completed";
    run.pauseReason = null;
    run.failureType = null;
    run.canResume = false;
    run.message = message;
    run.updatedAt = nowIso();
    run.finishedAt = nowIso();
    await runStore.save(run);

    logger.info(
      {
        runId: run.runId,
        totalCollected: run.totalCollected,
        totalInserted: run.totalInserted,
        estimatedCreditsUsed: run.estimatedCreditsUsed,
        estimatedCreditsByStep: {
          geocoding: run.estimatedCreditsGeocoding,
          search: run.estimatedCreditsSearch,
          details: run.estimatedCreditsDetails,
        },
      },
      "Execucao concluida",
    );

    return this.toResponse(run);
  }

  private async pauseRun(
    run: CollectionRunState,
    pauseReason: PauseReason,
    message: string,
    logger: LoggerLike,
  ) {
    run.status = "paused";
    run.pauseReason = pauseReason;
    run.failureType = null;
    run.canResume = true;
    run.message = message;
    run.updatedAt = nowIso();
    await runStore.save(run);

    logger.warn(
      {
        runId: run.runId,
        pauseReason,
        nextOffset: run.nextOffset,
        estimatedCreditsUsed: run.estimatedCreditsUsed,
        estimatedCreditsByStep: {
          geocoding: run.estimatedCreditsGeocoding,
          search: run.estimatedCreditsSearch,
          details: run.estimatedCreditsDetails,
        },
      },
      "Execucao pausada",
    );

    return this.toResponse(run);
  }

  private async pauseFromGeoapifyError(
    run: CollectionRunState,
    error: GeoapifyPauseError,
    logger: LoggerLike,
  ) {
    return this.pauseRun(
      run,
      error.kind === "rate_limit"
        ? "geoapify_rate_limit"
        : "geoapify_quota_exceeded",
      error.message,
      logger,
    );
  }

  private toResponse(run: CollectionRunState): CollectionResponse {
    return {
      ...run,
      items: run.recentItems,
    };
  }
}

export const collectionService = new CollectionService();
