import { useMemo, useState } from "react";
import type { CollectedPlace, RoutePlan } from "../types/api";
import { buildRoutePlans } from "../utils/routePlanning";

type RoutePlanningPanelProps = {
  items: CollectedPlace[];
};

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  );
}

export function RoutePlanningPanel({ items }: RoutePlanningPanelProps) {
  const [cityFilter, setCityFilter] = useState("");
  const [neighborhoodFilter, setNeighborhoodFilter] = useState("");
  const [groupSize, setGroupSize] = useState(12);
  const [routes, setRoutes] = useState<RoutePlan[]>([]);

  const routeEligibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === "coletado" &&
          item.latitude !== null &&
          item.longitude !== null,
      ),
    [items],
  );
  const cityOptions = useMemo(
    () => uniqueValues(routeEligibleItems.map((item) => item.city.trim())),
    [routeEligibleItems],
  );
  const neighborhoodOptions = useMemo(
    () => uniqueValues(routeEligibleItems.map((item) => item.neighborhood.trim())),
    [routeEligibleItems],
  );

  function handleGenerateRoutes() {
    const nextRoutes = buildRoutePlans({
      items: routeEligibleItems,
      cityFilter,
      neighborhoodFilter,
      groupSize,
    });

    setRoutes(nextRoutes);
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
        Esta etapa usa apenas itens com status <strong>coletado</strong> e com coordenadas
        disponiveis no frontend atual.
      </p>

      <div className="route-toolbar">
        <div className="field">
          <label htmlFor="route-city-filter">Cidade</label>
          <select
            id="route-city-filter"
            value={cityFilter}
            onChange={(event) => setCityFilter(event.target.value)}
          >
            <option value="">Todas</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="route-neighborhood-filter">Bairro</label>
          <select
            id="route-neighborhood-filter"
            value={neighborhoodFilter}
            onChange={(event) => setNeighborhoodFilter(event.target.value)}
          >
            <option value="">Todos</option>
            {neighborhoodOptions.map((neighborhood) => (
              <option key={neighborhood} value={neighborhood}>
                {neighborhood}
              </option>
            ))}
          </select>
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

        <button className="primary-button inline-action" type="button" onClick={handleGenerateRoutes}>
          Gerar rotas
        </button>
      </div>

      {routes.length === 0 ? (
        <p className="empty-state">
          Gere as rotas para visualizar agrupamentos por cidade e bairro com ordem de visitas.
        </p>
      ) : (
        <div className="route-list">
          {routes.map((route) => (
            <article key={route.id} className="route-card">
              <div className="route-card-header">
                <div>
                  <h3>{route.id}</h3>
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
                {route.stops.map((stop) => (
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
