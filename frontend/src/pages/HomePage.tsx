import { useEffect, useMemo, useRef, useState } from "react";
import { CollectionStatusPanel } from "../components/CollectionStatusPanel";
import { ResultsPreviewTable } from "../components/ResultsPreviewTable";
import { RoutePlanningPanel } from "../components/RoutePlanningPanel";
import { SearchForm } from "../components/SearchForm";
import {
  getCollection,
  resumeCollection,
  savePauseDecision,
  startCollection,
} from "../services/api";
import type {
  CollectionDecision,
  CollectionRequest,
  CollectionResponse,
} from "../types/api";

const initialValues: CollectionRequest = {
  searchTerm: "",
  city: "",
  state: "",
  maxResults: 10,
  spreadsheetId: "",
  sheetName: "Leads",
};

export function HomePage() {
  const routePlanningRef = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [collectionResult, setCollectionResult] =
    useState<CollectionResponse | null>(null);

  const previewItems = useMemo(
    () => collectionResult?.items ?? [],
    [collectionResult],
  );
  const executionInProgress =
    loading ||
    resumeLoading ||
    isPolling ||
    collectionResult?.status === "running";

  useEffect(() => {
    if (!collectionResult || collectionResult.status !== "running") {
      setIsPolling(false);
      return undefined;
    }

    setIsPolling(true);
    const intervalId = window.setInterval(async () => {
      try {
        const nextResult = await getCollection(collectionResult.runId);
        setCollectionResult(nextResult);

        if (nextResult.status !== "running") {
          setIsPolling(false);
          setSuccessMessage(nextResult.message);
        }
      } catch (error) {
        setIsPolling(false);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao atualizar o status da execucao.",
        );
      }
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [collectionResult]);

  async function handleCollection(values: CollectionRequest) {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await startCollection(values);
      setCollectionResult(response);
      setSuccessMessage(response.message);
    } catch (error) {
      setCollectionResult(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao iniciar a coleta.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(decision: CollectionDecision) {
    if (!collectionResult) {
      return;
    }

    try {
      setDecisionLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await savePauseDecision(collectionResult.runId, decision);
      setCollectionResult(response);
      setSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao registrar a decisao da pausa.",
      );
    } finally {
      setDecisionLoading(false);
    }
  }

  async function handleResume() {
    if (!collectionResult) {
      return;
    }

    try {
      setResumeLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await resumeCollection(collectionResult.runId);
      setCollectionResult(response);
      setSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao retomar a execucao.",
      );
    } finally {
      setResumeLoading(false);
    }
  }

  function handleGoToRoutes() {
    routePlanningRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="page-shell">
      <section className="hero operational-hero">
        <div>
          <p className="eyebrow">Operacao Geoapify + Sheets</p>
          <h1>Painel operacional de coleta e preparacao de rotas</h1>
          <p className="hero-copy">
            Inicie coletas, acompanhe o progresso em tempo real, revise os leads encontrados
            e organize blocos de visitas sem sair do painel.
          </p>
        </div>
        <div className="hero-sidecard panel">
          <p className="hero-metric-label">Fluxo atual</p>
          <strong>Buscar, exportar e preparar visitas</strong>
          <span>Pronto para operacao local e planejamento logistico inicial.</span>
        </div>
      </section>

      <SearchForm
        initialValues={initialValues}
        loading={loading}
        disabled={executionInProgress}
        onSubmit={handleCollection}
      />

      {errorMessage ? <div className="feedback error">{errorMessage}</div> : null}
      {successMessage ? <div className="feedback success">{successMessage}</div> : null}

      <CollectionStatusPanel
        collectionResult={collectionResult}
        polling={isPolling}
        decisionLoading={decisionLoading}
        resumeLoading={resumeLoading}
        onDecision={handleDecision}
        onResume={handleResume}
        onGoToRoutes={handleGoToRoutes}
      />

      <ResultsPreviewTable items={previewItems} />

      <section ref={routePlanningRef}>
        <RoutePlanningPanel items={previewItems} />
      </section>
    </main>
  );
}
