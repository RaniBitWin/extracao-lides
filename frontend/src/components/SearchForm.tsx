import { useState, type FormEvent } from "react";
import type { CollectionRequest } from "../types/api";

type SearchFormProps = {
  initialValues: CollectionRequest;
  loading: boolean;
  onSubmit: (values: CollectionRequest) => Promise<void>;
};

export function SearchForm({
  initialValues,
  loading,
  onSubmit,
}: SearchFormProps) {
  const [formValues, setFormValues] = useState<CollectionRequest>(initialValues);

  function updateField<K extends keyof CollectionRequest>(
    field: K,
    value: CollectionRequest[K],
  ) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(formValues);
  }

  return (
    <form className="panel form-grid" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="searchTerm">Termo de busca</label>
        <input
          id="searchTerm"
          name="searchTerm"
          value={formValues.searchTerm}
          onChange={(event) => updateField("searchTerm", event.target.value)}
          placeholder="restaurantes em Sao Jose SC"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="maxResults">Quantidade maxima de resultados</label>
        <input
          id="maxResults"
          name="maxResults"
          type="number"
          min={1}
          max={100}
          value={formValues.maxResults}
          onChange={(event) =>
            updateField("maxResults", Number(event.target.value))
          }
          required
        />
      </div>

      <div className="field">
        <label htmlFor="spreadsheetId">ID da planilha Google Sheets</label>
        <input
          id="spreadsheetId"
          name="spreadsheetId"
          value={formValues.spreadsheetId}
          onChange={(event) => updateField("spreadsheetId", event.target.value)}
          placeholder="1AbCdEf..."
          required
        />
      </div>

      <div className="field">
        <label htmlFor="sheetName">Nome da aba</label>
        <input
          id="sheetName"
          name="sheetName"
          value={formValues.sheetName}
          onChange={(event) => updateField("sheetName", event.target.value)}
          placeholder="Leads"
          required
        />
      </div>

      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? "Processando..." : "Iniciar coleta"}
      </button>
    </form>
  );
}
