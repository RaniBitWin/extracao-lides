import { useState } from "react";
import { generateRoutes } from "../services/api";
import type { CollectionResponse, GenerateRoutesResponse } from "../types/api";

type RoutePlanningPanelProps = {
  collectionResult: CollectionResponse | null;
};

export function RoutePlanningPanel({ collectionResult }: RoutePlanningPanelProps) {
  const [cityFilter, setCityFilter] = useState("");
  const [neighborhoodFilter, setNeighborhoodFilter] = useState("");
  const [groupSize, setGroupSize] = useState(12);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [routesResult, setRoutesResult] = useState<GenerateRoutesResponse | null>(null);

  async function handleGenerateRoutes() {
    if (!collectionResult) {
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      const nextRoutes = await generateRoutes({
        spreadsheetId: collectionResult.spreadsheetId,
        sheetName: collectionResult.sheetName,
        city: cityFilter || undefined,
        neighborhood: neighborhoodFilter || undefined,
        groupSize,
      });

      setRoutesResult(nextRoutes);
    } catch (error) {
      setRoutesResult(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao gerar as rotas.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel" id="route-planning">
      <div className="section-header">
        <div>
          <h2>Planejamento de Rotas</h2>
          <p>Agrupe os leads coletados para preparar a operacao de visitas.</p>
        </div>
      </div>

      <p className="route-helper-copy">
        Esta etapa agora gera rotas reais a partir dos leads da aba informada no Google Sheets.
      </p>

      <div className="route-toolbar">
        <div className="field">
          <label htmlFor="route-city-filter">Cidade</label>
          <input
            id="route-city-filter"
            value={cityFilter}
            onChange={(event) => setCityFilter(event.target.value)}
            placeholder="Filtrar por cidade"
          />
        </div>

        <div className="field">
          <label htmlFor="route-neighborhood-filter">Bairro</label>
          <input
            id="route-neighborhood-filter"
            value={neighborhoodFilter}
            onChange={(event) => setNeighborhoodFilter(event.target.value)}
            placeholder="Filtrar por bairro"
          />
        </div>

        <div className="field">
          <label htmlFor="route-group-size">Tamanho do grupo</label>
          <input
            id="route-group-size"
            type="number"
            min={1}
            max={50}
            value={groupSize}
            onChange={(event) => setGroupSize(Number(event.target.value) || 1)}
          />
        </div>

        <button
          className="primary-button inline-action"
          type="button"
          onClick={handleGenerateRoutes}
          disabled={!collectionResult || loading}
        >
          {loading ? "Gerando..." : "Gerar rotas"}
        </button>
      </div>

      {errorMessage ? <div className="feedback error">{errorMessage}</div> : null}

      {!routesResult || routesResult.routes.length === 0 ? (
        <p className="empty-state">
          Gere as rotas para visualizar agrupamentos reais da planilha por cidade e bairro.
        </p>
      ) : (
        <div className="route-list">
          <div className="route-summary">
            <span>{routesResult.totalEligibleLeads} leads elegiveis</span>
            <span>{routesResult.totalRoutes} rotas geradas</span>
          </div>

          {routesResult.routes.map((route) => (
            <article key={route.routeId} className="route-card">
              <div className="route-card-header">
                <div>
                  <h3>{route.routeId}</h3>
                  <p>
                    {route.city} · {route.predominantNeighborhood}
                  </p>
                </div>
                {route.externalLink ? (
                  <a href={route.externalLink} target="_blank" rel="noreferrer" className="route-link">
                    Abrir rota
                  </a>
                ) : (
                  <span className="route-link disabled">Sem coordenadas suficientes</span>
                )}
              </div>

              <div className="route-metrics">
                <span>{route.stopCount} paradas</span>
                <span>{route.estimatedDistanceKm} km estimados</span>
              </div>

              <ol className="route-stop-list">
                {route.visits.map((stop) => (
                  <li key={stop.placeId}>
                    <strong>{stop.name}</strong>
                    <span>
                      {stop.address} · {stop.neighborhood || "Sem bairro"}
                    </span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
