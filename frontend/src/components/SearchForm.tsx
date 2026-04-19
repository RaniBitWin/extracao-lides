import { useState, type FormEvent } from "react";
import type { CollectionRequest } from "../types/api";

type SearchFormProps = {
  initialValues: CollectionRequest;
  loading: boolean;
  disabled?: boolean;
  onSubmit: (values: CollectionRequest) => Promise<void>;
};

export function SearchForm({
  initialValues,
  loading,
  disabled = false,
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
          placeholder="restaurantes, pizzarias, padarias..."
          disabled={disabled}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="city">Cidade</label>
        <input
          id="city"
          name="city"
          value={formValues.city}
          onChange={(event) => updateField("city", event.target.value)}
          placeholder="Sao Jose"
          disabled={disabled}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="state">Estado</label>
        <input
          id="state"
          name="state"
          value={formValues.state}
          onChange={(event) => updateField("state", event.target.value)}
          placeholder="SC"
          disabled={disabled}
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
          disabled={disabled}
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
          disabled={disabled}
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
          disabled={disabled}
          required
        />
      </div>

      <button className="primary-button" type="submit" disabled={loading || disabled}>
        {loading ? "Buscando..." : "Buscar e Exportar"}
      </button>
    </form>
  );
}
