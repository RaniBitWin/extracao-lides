import { useState } from "react";
import { SearchForm } from "../components/SearchForm";
import {
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

function formatPauseReason(reason: CollectionResponse["pauseReason"]) {
  if (reason === "daily_credit_limit_estimated") {
    return "Limite diario estimado de creditos";
  }

  if (reason === "geoapify_rate_limit") {
    return "Rate limit da Geoapify";
  }

  if (reason === "geoapify_quota_exceeded") {
    return "Quota/creditos da Geoapify";
  }

  return "Sem pausa";
}

export function HomePage() {
  const [loading, setLoading] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [collectionResult, setCollectionResult] =
    useState<CollectionResponse | null>(null);

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

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Geoapify + Sheets</p>
        <h1>Extracao com pausa por limite e retomada do ponto salvo</h1>
        <p className="hero-copy">
          A coleta agora usa Geoapify como fonte principal, monitora consumo
          estimado de creditos, pausa quando necessario e grava no Google Sheets
          durante a execucao.
        </p>
      </section>

      <SearchForm
        initialValues={initialValues}
        loading={loading}
        onSubmit={handleCollection}
      />

      {errorMessage ? <div className="feedback error">{errorMessage}</div> : null}
      {successMessage ? (
        <div className="feedback success">{successMessage}</div>
      ) : null}

      <section className="panel">
        <div className="section-header">
          <div>
            <h2>Status da execucao</h2>
            <p>Resumo da coleta, progresso salvo e situacao atual.</p>
          </div>
        </div>

        {!collectionResult ? (
          <p className="empty-state">Nenhuma execucao iniciada ainda.</p>
        ) : (
          <>
            <div className="stats-grid">
              <article>
                <span>Status</span>
                <strong>{collectionResult.status}</strong>
              </article>
              <article>
                <span>Coletados</span>
                <strong>{collectionResult.totalCollected}</strong>
              </article>
              <article>
                <span>Inseridos</span>
                <strong>{collectionResult.totalInserted}</strong>
              </article>
              <article>
                <span>Ignorados</span>
                <strong>{collectionResult.totalIgnored}</strong>
              </article>
              <article>
                <span>Erros</span>
                <strong>{collectionResult.totalWithError}</strong>
              </article>
              <article>
                <span>Proximo offset</span>
                <strong>{collectionResult.nextOffset}</strong>
              </article>
              <article>
                <span>Creditos usados</span>
                <strong>{collectionResult.estimatedCreditsUsed}</strong>
              </article>
              <article>
                <span>Creditos restantes</span>
                <strong>{collectionResult.estimatedCreditsRemaining}</strong>
              </article>
              <article>
                <span>Motivo da pausa</span>
                <strong>{formatPauseReason(collectionResult.pauseReason)}</strong>
              </article>
              <article>
                <span>Raio atual</span>
                <strong>{collectionResult.currentRadiusMeters} m</strong>
              </article>
              <article>
                <span>Falha</span>
                <strong>{collectionResult.failureType ?? "nenhuma"}</strong>
              </article>
            </div>

            <div className="status-card">
              <p>
                <strong>Execucao:</strong> {collectionResult.runId}
              </p>
              <p>
                <strong>Categoria:</strong>{" "}
                {collectionResult.geoapifyCategoryLabel ?? "Nao resolvida"}
              </p>
              <p>
                <strong>Cidade/Estado:</strong> {collectionResult.city} /{" "}
                {collectionResult.state}
              </p>
              <p>
                <strong>Local resolvido:</strong>{" "}
                {collectionResult.resolvedLocation ?? "Nao resolvido"}
              </p>
              <p>
                <strong>Mensagem:</strong> {collectionResult.message}
              </p>
            </div>

            {collectionResult.status === "paused" ? (
              <div className="pause-actions">
                <p className="pause-copy">
                  A extracao foi pausada. Escolha como deseja seguir e, quando
                  fizer sentido, use a retomada para continuar do ponto salvo.
                </p>
                <div className="button-row">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => handleDecision("continue_next_day")}
                    disabled={decisionLoading}
                  >
                    {decisionLoading
                      ? "Salvando..."
                      : "Encerrar e continuar amanha"}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => handleDecision("wait_for_paid_plan")}
                    disabled={decisionLoading}
                  >
                    {decisionLoading
                      ? "Salvando..."
                      : "Aguardar plano pago"}
                  </button>
                  <button
                    className="primary-button inline-action"
                    type="button"
                    onClick={handleResume}
                    disabled={resumeLoading}
                  >
                    {resumeLoading ? "Retomando..." : "Retomar execucao"}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="results-table-wrapper">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Endereco</th>
                    <th>Cidade</th>
                    <th>Telefone</th>
                    <th>Website</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionResult.items.map((item) => (
                    <tr key={item.placeId}>
                      <td>{item.name}</td>
                      <td>{item.address}</td>
                      <td>{item.city}</td>
                      <td>{item.phone}</td>
                      <td>{item.website || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
