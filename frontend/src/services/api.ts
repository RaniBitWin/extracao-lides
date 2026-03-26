import type {
  CollectionDecision,
  CollectionRequest,
  CollectionResponse,
  WriteSheetsRequest,
  WriteSheetsResponse,
} from "../types/api";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.toString() ?? "http://localhost:3001";

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data.message === "string"
        ? data.message
        : "Falha na comunicacao com o backend.";

    throw new Error(message);
  }

  return data as T;
}

export function startCollection(payload: CollectionRequest) {
  return request<CollectionResponse>("/api/collection/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCollection(runId: string) {
  return request<CollectionResponse>(`/api/collection/${runId}`, {
    method: "GET",
  });
}

export function resumeCollection(runId: string) {
  return request<CollectionResponse>(`/api/collection/${runId}/resume`, {
    method: "POST",
  });
}

export function savePauseDecision(runId: string, decision: CollectionDecision) {
  return request<CollectionResponse>(`/api/collection/${runId}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}

export function writeToSheets(payload: WriteSheetsRequest) {
  return request<WriteSheetsResponse>("/api/sheets/write", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
