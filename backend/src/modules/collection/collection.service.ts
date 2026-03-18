import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import type {
  CollectedPlace,
  CollectionInput,
  CollectionResult,
} from "./collection.types.js";

export class CollectionService {
  async startCollection(
    input: CollectionInput,
    logger: { info: (payload: object, message?: string) => void },
  ): Promise<CollectionResult> {
    logger.info(
      {
        searchTerm: input.searchTerm,
        maxResults: input.maxResults,
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
        mode: env.COLLECTION_MOCK_MODE ? "mock" : "google",
      },
      "Iniciando coleta",
    );

    if (!env.COLLECTION_MOCK_MODE && !env.GOOGLE_MAPS_API_KEY) {
      throw new AppError(
        "GOOGLE_MAPS_API_KEY nao configurada para coleta real.",
        500,
        "MISSING_MAPS_API_KEY",
      );
    }

    const items = env.COLLECTION_MOCK_MODE
      ? this.buildMockPlaces(input.searchTerm, input.maxResults)
      : [];

    const runId = randomUUID();

    logger.info(
      {
        runId,
        totalCollected: items.length,
      },
      "Coleta finalizada",
    );

    return {
      runId,
      searchTerm: input.searchTerm,
      maxResults: input.maxResults,
      spreadsheetId: input.spreadsheetId,
      sheetName: input.sheetName,
      totalCollected: items.length,
      items,
      source: env.COLLECTION_MOCK_MODE ? "mock" : "google",
    };
  }

  private buildMockPlaces(searchTerm: string, maxResults: number): CollectedPlace[] {
    const safeCount = Math.min(maxResults, 10);

    return Array.from({ length: safeCount }, (_, index) => ({
      placeId: `mock-place-${index + 1}`,
      name: `Resultado ${index + 1} para ${searchTerm}`,
      address: `Rua Exemplo ${index + 100}, Centro, Sao Jose - SC`,
      phone: index % 3 === 0 ? null : `(48) 3333-44${String(index).padStart(2, "0")}`,
    }));
  }
}

export const collectionService = new CollectionService();
