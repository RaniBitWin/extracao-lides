import type { CollectedPlace } from "../types/api";

type ResultsPreviewTableProps = {
  items: CollectedPlace[];
};

export function ResultsPreviewTable({ items }: ResultsPreviewTableProps) {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <h2>Previa dos resultados</h2>
          <p>Leads mais recentes da execucao atual, antes da etapa de roteirizacao.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="empty-state">Nenhum resultado disponivel para visualizacao ainda.</p>
      ) : (
        <div className="results-table-wrapper">
          <table className="results-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Endereco</th>
                <th>Bairro</th>
                <th>Cidade</th>
                <th>Telefone</th>
                <th>Website</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.placeId}>
                  <td>{item.name}</td>
                  <td>{item.address}</td>
                  <td>{item.neighborhood || "-"}</td>
                  <td>{item.city}</td>
                  <td>{item.phone || "-"}</td>
                  <td>
                    {item.website ? (
                      <a href={item.website} target="_blank" rel="noreferrer">
                        abrir
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{item.latitude ?? "-"}</td>
                  <td>{item.longitude ?? "-"}</td>
                  <td>
                    <span className={`status-chip status-${item.status}`}>{item.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
