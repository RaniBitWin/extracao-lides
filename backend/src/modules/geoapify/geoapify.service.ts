import { env } from "../../config/env.js";
import { geoapifyClient } from "./geoapify.client.js";
import type { GeoapifyResolvedQuery } from "./geoapify.types.js";

type LoggerLike = {
  info: (payload: object, message?: string) => void;
};

const CATEGORY_MAP: Array<{
  aliases: string[];
  category: string;
  label: string;
  relevanceTerms: string[];
}> = [
  {
    aliases: ["pizzaria", "pizzarias", "pizza", "pizzas"],
    category: "catering.restaurant",
    label: "pizzarias",
    relevanceTerms: ["pizza", "pizzaria", "pizzarias"],
  },
  {
    aliases: ["restaurante", "restaurantes", "restaurant", "restaurants"],
    category: "catering.restaurant",
    label: "restaurantes",
    relevanceTerms: ["restaurante", "restaurantes", "restaurant"],
  },
  {
    aliases: ["lanchonete", "lanchonetes", "lanche", "lanches"],
    category: "catering.fast_food",
    label: "lanchonetes",
    relevanceTerms: ["lanche", "lanchonete", "fast food", "burger", "hamburguer"],
  },
  {
    aliases: ["padaria", "padarias", "bakery", "bakeries"],
    category: "commercial.food_and_drink.bakery",
    label: "padarias",
    relevanceTerms: ["padaria", "padarias", "bakery", "pao", "paes"],
  },
  {
    aliases: ["cafe", "cafes", "cafeteria", "cafeterias", "coffee shop", "cafeteria gourmet"],
    category: "catering.cafe",
    label: "cafes",
    relevanceTerms: ["cafe", "cafeteria"],
  },
  {
    aliases: ["bar", "bares", "pub", "pubs"],
    category: "catering.bar",
    label: "bares",
    relevanceTerms: ["bar", "bares", "pub"],
  },
  {
    aliases: ["hotel", "hoteis", "hotels"],
    category: "accommodation.hotel",
    label: "hoteis",
    relevanceTerms: ["hotel", "hoteis", "motel"],
  },
  {
    aliases: ["supermercado", "supermercados", "mercado", "mercados"],
    category: "commercial.supermarket",
    label: "supermercados",
    relevanceTerms: ["mercado", "supermercado"],
  },
  {
    aliases: ["farmacia", "farmacias", "drogaria", "drogarias"],
    category: "healthcare.pharmacy",
    label: "farmacias",
    relevanceTerms: ["farmacia", "drogaria"],
  },
  {
    aliases: ["posto", "postos", "combustivel"],
    category: "service.vehicle.fuel",
    label: "postos",
    relevanceTerms: ["posto", "combustivel", "gasolina"],
  },
  {
    aliases: ["hamburgueria", "hamburguerias", "hamburguer", "hamburgueres", "burger", "burgers"],
    category: "catering.fast_food.burger",
    label: "hamburguerias",
    relevanceTerms: ["hamburgueria", "hamburguer", "burger"],
  },
  {
    aliases: ["acougue", "acougues", "carnicaria", "casa de carnes"],
    category: "commercial.food_and_drink.butcher",
    label: "acougues",
    relevanceTerms: ["acougue", "carnes", "butcher"],
  },
  {
    aliases: ["pet shop", "pet shops", "petshop", "petshops"],
    category: "pet.shop",
    label: "pet shops",
    relevanceTerms: ["pet", "pet shop"],
  },
  {
    aliases: ["barbearia", "barbearias"],
    category: "service.beauty.hairdresser",
    label: "barbearias",
    relevanceTerms: ["barbearia", "barbearias"],
  },
  {
    aliases: ["salao de beleza", "saloes de beleza", "salão de beleza", "salões de beleza"],
    category: "service.beauty.hairdresser",
    label: "saloes de beleza",
    relevanceTerms: ["salao", "beleza", "cabelo"],
  },
  {
    aliases: ["academia", "academias", "fitness", "gym", "gimnasio"],
    category: "sport.fitness.fitness_centre",
    label: "academias",
    relevanceTerms: ["academia", "fitness", "gym"],
  },
  {
    aliases: ["floricultura", "floriculturas", "florista", "floristas"],
    category: "commercial.florist",
    label: "floriculturas",
    relevanceTerms: ["floricultura", "florista", "flores"],
  },
  {
    aliases: ["papelaria", "papelarias"],
    category: "commercial.stationery",
    label: "papelarias",
    relevanceTerms: ["papelaria", "papelarias"],
  },
  {
    aliases: ["lavanderia", "lavanderias", "laundry"],
    category: "service.cleaning.laundry",
    label: "lavanderias",
    relevanceTerms: ["lavanderia", "laundry"],
  },
];

const SUPPORTED_GEOAPIFY_CATEGORIES = new Set<string>([
  "catering.restaurant",
  "catering.fast_food",
  "commercial.food_and_drink.bakery",
  "catering.cafe",
  "catering.bar",
  "accommodation.hotel",
  "commercial.supermarket",
  "commercial.food_and_drink.butcher",
  "pet.shop",
  "service.beauty.hairdresser",
  "sport.fitness.fitness_centre",
  "commercial.florist",
  "commercial.stationery",
  "service.cleaning.laundry",
  "catering.fast_food.burger",
  "healthcare.pharmacy",
  "service.vehicle.fuel",
  "commercial",
]);

const CATEGORY_CORRECTIONS: Record<string, string> = {
  "catering.bakery": "commercial.food_and_drink.bakery",
  "catering.pizza": "catering.restaurant",
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function buildTokenSet(value: string) {
  const variants = new Set<string>();

  for (const token of tokenize(value)) {
    variants.add(token);

    if (token.length > 3 && token.endsWith("s")) {
      variants.add(token.slice(0, -1));
    }
  }

  return variants;
}

function matchesAlias(tokenSet: Set<string>, alias: string) {
  const aliasTokens = tokenize(alias);

  if (aliasTokens.length === 0) {
    return false;
  }

  return aliasTokens.every((token) => tokenSet.has(token));
}

export class GeoapifyService {
  resolveCategory(searchTerm: string) {
    const normalizedTerm = normalizeText(searchTerm);
    const tokenSet = buildTokenSet(normalizedTerm);
    const normalizedTokens = Array.from(tokenSet);

    const matchedCategory = CATEGORY_MAP.find((entry) =>
      entry.aliases.some((alias) => matchesAlias(tokenSet, alias)),
    );

    if (matchedCategory) {
      return {
        ...matchedCategory,
        normalizedTokens,
        categorySource: "dictionary" as const,
        trustedCategory: true,
      };
    }

    return {
      category: "commercial",
      label: "estabelecimentos comerciais",
      normalizedTokens,
      categorySource: "fallback" as const,
      relevanceTerms: normalizedTerm
        .split(/\s+/)
        .filter((term) => term.length >= 4),
      trustedCategory: false,
    };
  }

  validateCategorySelection(input: {
    searchTerm: string;
    inferredCategory: string;
    label: string;
    relevanceTerms: string[];
    trustedCategory: boolean;
    fallbackCategory?: string;
  }) {
    const initialCategory = input.inferredCategory;
    const correctedCategory = CATEGORY_CORRECTIONS[initialCategory] ?? initialCategory;

    if (SUPPORTED_GEOAPIFY_CATEGORIES.has(correctedCategory)) {
      return {
        initialCategory,
        category: correctedCategory,
        categoryLabel: input.label,
        trustedCategory: input.trustedCategory,
        relevanceTerms: input.relevanceTerms,
        fallbackReason:
          correctedCategory !== initialCategory
            ? "categoria_invalida_corrigida_automaticamente"
            : null,
        autoCorrectedCategory: correctedCategory !== initialCategory,
      };
    }

    const fallbackCandidate =
      (input.fallbackCategory && CATEGORY_CORRECTIONS[input.fallbackCategory]) ||
      input.fallbackCategory ||
      "commercial";

    if (fallbackCandidate && SUPPORTED_GEOAPIFY_CATEGORIES.has(fallbackCandidate)) {
      return {
        initialCategory,
        category: fallbackCandidate,
        categoryLabel:
          fallbackCandidate === "commercial" ? "estabelecimentos comerciais" : input.label,
        trustedCategory: fallbackCandidate === "commercial" ? false : input.trustedCategory,
        relevanceTerms: input.relevanceTerms,
        fallbackReason: "categoria_invalida_com_fallback_controlado",
        autoCorrectedCategory: true,
      };
    }

    return {
      initialCategory,
      category: "commercial",
      categoryLabel: "estabelecimentos comerciais",
      trustedCategory: false,
      relevanceTerms: input.relevanceTerms,
      fallbackReason: "categoria_invalida_sem_categoria_suportada",
      autoCorrectedCategory: true,
    };
  }

  buildLocationQuery(city: string, state: string) {
    return `${city.trim()}, ${state.trim()}, Brasil`;
  }

  async resolveQuery(input: {
    searchTerm: string;
    city: string;
    state: string;
  }, logger?: LoggerLike): Promise<GeoapifyResolvedQuery> {
    const category = this.resolveCategory(input.searchTerm);
    const validatedCategory = this.validateCategorySelection({
      searchTerm: input.searchTerm,
      inferredCategory: category.category,
      label: category.label,
      relevanceTerms: category.relevanceTerms,
      trustedCategory: category.trustedCategory,
      fallbackCategory: "commercial",
    });
    const locationQuery = this.buildLocationQuery(input.city, input.state);
    const geocoded = await geoapifyClient.geocode(locationQuery);

    logger?.info(
      {
        searchTerm: input.searchTerm,
        normalizedTokens: category.normalizedTokens,
        initialCategory: validatedCategory.initialCategory,
        validatedCategory: validatedCategory.category,
        categorySource: category.categorySource,
        fallbackReason: validatedCategory.fallbackReason,
        autoCorrectedCategory: validatedCategory.autoCorrectedCategory,
      },
      "Geoapify: categoria inferida e validada",
    );

    return {
      initialCategory: validatedCategory.initialCategory,
      category: validatedCategory.category,
      categoryLabel: validatedCategory.categoryLabel,
      categorySource: category.categorySource,
      normalizedTokens: category.normalizedTokens,
      trustedCategory: validatedCategory.trustedCategory,
      relevanceTerms: validatedCategory.relevanceTerms,
      fallbackReason: validatedCategory.fallbackReason,
      autoCorrectedCategory: validatedCategory.autoCorrectedCategory,
      locationQuery,
      resolvedAddress: geocoded.formatted,
      lat: geocoded.lat,
      lon: geocoded.lon,
      radiusMeters: env.GEOAPIFY_SEARCH_RADIUS_METERS,
    };
  }
}

export const geoapifyService = new GeoapifyService();
