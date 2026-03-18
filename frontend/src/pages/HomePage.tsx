import { useState } from "react";
import { SearchForm } from "../components/SearchForm";
import { startCollection, writeToSheets } from "../services/api";
import type {
  CollectionRequest,
  CollectionResponse,
  WriteSheetsResponse,
} from "../types/api";

const initialValues: CollectionRequest = {
  searchTerm: "",
  maxResults: 10,
  spreadsheetId: "",
  sheetName: "Leads",
};

export function HomePage() {
  const [loading, setLoading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [collectionResult, setCollectionResult] =
    useState<CollectionResponse | null>(null);
  const [writeResult, setWriteResult] = useState<WriteSheetsResponse | null>(
    null,
  );

  async function handleCollection(values: CollectionRequest) {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");
      setWriteResult(null);

      const response = await startCollection(values);
      setCollectionResult(response);
      setSuccessMessage(
        `Coleta concluida com ${response.totalCollected} resultado(s).`,
      );
    } catch (error) {
      setCollectionResult(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao iniciar a coleta.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleWrite() {
    if (!collectionResult) {
      return;
    }

    try {
      setWriting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await writeToSheets({
        spreadsheetId: collectionResult.spreadsheetId,
        sheetName: collectionResult.sheetName,
        rows: collectionResult.items,
      });

      setWriteResult(response);
      setSuccessMessage(response.message);
    } catch (error) {
      setWriteResult(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao gravar na planilha.",
      );
    } finally {
      setWriting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Maps + Sheets</p>
        <h1>Coleta inicial de estabelecimentos com backend preparado</h1>
        <p className="hero-copy">
          Informe a busca, limite de resultados e dados da planilha. O backend
          valida a entrada, simula a coleta nesta fase inicial e prepara a
          escrita no Google Sheets.
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
            <h2>Resultados da coleta</h2>
            <p>Visualizacao do retorno atual do backend.</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={handleWrite}
            disabled={!collectionResult || writing}
          >
            {writing ? "Gravando..." : "Gravar resultados na planilha"}
          </button>
        </div>

        {!collectionResult ? (
          <p className="empty-state">Nenhuma coleta executada ainda.</p>
        ) : (
          <>
            <div className="stats-grid">
              <article>
                <span>Execucao</span>
                <strong>{collectionResult.runId}</strong>
              </article>
              <article>
                <span>Origem</span>
                <strong>{collectionResult.source}</strong>
              </article>
              <article>
                <span>Total coletado</span>
                <strong>{collectionResult.totalCollected}</strong>
              </article>
            </div>

            <div className="results-table-wrapper">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Endereco</th>
                    <th>Telefone</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionResult.items.map((item) => (
                    <tr key={item.placeId}>
                      <td>{item.name}</td>
                      <td>{item.address}</td>
                      <td>{item.phone ?? "Nao informado"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {writeResult ? (
        <section className="panel">
          <h2>Retorno da gravacao</h2>
          <p>
            {writeResult.rowsWritten} linha(s) processadas para a aba{" "}
            <strong>{writeResult.sheetName}</strong> em modo{" "}
            <strong>{writeResult.mode}</strong>.
          </p>
        </section>
      ) : null}
    </main>
  );
}
