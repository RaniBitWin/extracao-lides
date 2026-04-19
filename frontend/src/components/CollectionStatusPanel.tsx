import type { CollectionDecision, CollectionResponse } from "../types/api";

type CollectionStatusPanelProps = {
  collectionResult: CollectionResponse | null;
  polling: boolean;
  decisionLoading: boolean;
  resumeLoading: boolean;
  onDecision: (decision: CollectionDecision) => Promise<void>;
  onResume: () => Promise<void>;
  onGoToRoutes: () => void;
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

function formatStatusLabel(status: CollectionResponse["status"]) {
  if (status === "running") {
    return "Executando";
  }

  if (status === "paused") {
    return "Pausada";
  }

  if (status === "completed") {
    return "Concluida";
  }

  return "Erro";
}

export function CollectionStatusPanel({
  collectionResult,
  polling,
  decisionLoading,
  resumeLoading,
  onDecision,
  onResume,
  onGoToRoutes,
}: CollectionStatusPanelProps) {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <h2>Status da execucao</h2>
          <p>Progresso operacional, creditos estimados e situacao atual da coleta.</p>
        </div>
        {polling ? <span className="live-badge">Atualizando em tempo real</span> : null}
      </div>

      {!collectionResult ? (
        <p className="empty-state">Nenhuma execucao iniciada ainda.</p>
      ) : (
        <>
          <div className="stats-grid">
            <article>
              <span>Run ID</span>
              <strong>{collectionResult.runId}</strong>
            </article>
            <article>
              <span>Status</span>
              <strong>
                <span className={`status-chip run-status status-${collectionResult.status}`}>
                  {formatStatusLabel(collectionResult.status)}
                </span>
              </strong>
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
          </div>

          <div className="status-card-grid">
            <div className="status-card">
              <p>
                <strong>Categoria:</strong>{" "}
                {collectionResult.geoapifyCategoryLabel ?? "Nao resolvida"}
              </p>
              <p>
                <strong>Cidade/Estado:</strong> {collectionResult.city} / {collectionResult.state}
              </p>
              <p>
                <strong>Local resolvido:</strong>{" "}
                {collectionResult.resolvedLocation ?? "Nao resolvido"}
              </p>
              <p>
                <strong>Mensagem:</strong> {collectionResult.message}
              </p>
            </div>

            <div className="status-card subtle-card">
              <p>
                <strong>Offset:</strong> {collectionResult.nextOffset}
              </p>
              <p>
                <strong>Raio atual:</strong> {collectionResult.currentRadiusMeters} m
              </p>
              <p>
                <strong>Falha:</strong> {collectionResult.failureType ?? "nenhuma"}
              </p>
              <p>
                <strong>Atualizado em:</strong>{" "}
                {new Date(collectionResult.updatedAt).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>

          {collectionResult.status === "paused" ? (
            <div className="pause-actions">
              <p className="pause-copy">
                A extracao foi pausada. Escolha como deseja seguir e retome quando fizer sentido.
              </p>
              <div className="button-row">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onDecision("continue_next_day")}
                  disabled={decisionLoading}
                >
                  {decisionLoading ? "Salvando..." : "Encerrar por hoje"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onDecision("wait_for_paid_plan")}
                  disabled={decisionLoading}
                >
                  {decisionLoading ? "Salvando..." : "Retomar depois"}
                </button>
                <button
                  className="primary-button inline-action"
                  type="button"
                  onClick={onResume}
                  disabled={resumeLoading}
                >
                  {resumeLoading ? "Retomando..." : "Retomar execucao"}
                </button>
              </div>
            </div>
          ) : null}

          {collectionResult.status === "failed" ? (
            <div className="failure-actions">
              <p className="failure-copy">
                A execucao terminou com erro. Revise a mensagem acima e ajuste a configuracao antes
                de tentar novamente.
              </p>
            </div>
          ) : null}

          {collectionResult.status === "completed" ? (
            <div className="completion-actions">
              <p className="completion-copy">
                Coleta concluida. Se os dados parecerem corretos, siga para o planejamento de rotas.
              </p>
              <button className="primary-button inline-action" type="button" onClick={onGoToRoutes}>
                Gerar rotas logisticas
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
