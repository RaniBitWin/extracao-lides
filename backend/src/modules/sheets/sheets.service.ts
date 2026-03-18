import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { sheetsClient } from "./sheets.client.js";
import type { WriteSheetsInput, WriteSheetsResult } from "./sheets.types.js";

type LoggerLike = {
  info: (payload: object, message?: string) => void;
  error: (payload: object, message?: string) => void;
};

export class SheetsService {
  async writeRows(
    input: WriteSheetsInput,
    logger: LoggerLike,
  ): Promise<WriteSheetsResult> {
    const spreadsheetId = input.spreadsheetId ?? env.GOOGLE_SHEET_ID;

    logger.info(
      {
        spreadsheetId,
        sheetName: input.sheetName,
        rowsReceived: input.rows.length,
        mode: env.COLLECTION_MOCK_MODE ? "mock" : "google",
      },
      "Preparando escrita na planilha",
    );

    if (input.rows.length === 0) {
      throw new AppError(
        "Nenhum resultado foi enviado para gravacao.",
        400,
        "EMPTY_ROWS",
      );
    }

    if (!spreadsheetId) {
      throw new AppError(
        "Informe spreadsheetId na requisicao ou configure GOOGLE_SHEET_ID.",
        400,
        "MISSING_SPREADSHEET_ID",
      );
    }

    if (env.COLLECTION_MOCK_MODE) {
      const normalizedRows = input.rows.map((row) => this.normalizePlace(row));
      const deduplicated = this.removeInternalDuplicates(normalizedRows);

      logger.info(
        {
          spreadsheetId,
          sheetName: input.sheetName,
          rowsWritten: deduplicated.uniqueRows.length,
          ignoredDuplicates: deduplicated.ignoredDuplicates,
        },
        "Gravacao simulada concluida",
      );

      return {
        spreadsheetId,
        sheetName: input.sheetName,
        totalCollected: input.rows.length,
        totalInserted: deduplicated.uniqueRows.length,
        totalIgnored: deduplicated.ignoredDuplicates,
        totalWithError: 0,
        insertedRows: deduplicated.uniqueRows.length,
        ignoredDuplicates: deduplicated.ignoredDuplicates,
        mode: "mock",
        message: "Modo mock ativo: resultados validados e simulados para gravacao.",
      };
    }

    try {
      await sheetsClient.ensureSheetInitialized(spreadsheetId, input.sheetName);

      const normalizedRows = input.rows.map((row) => this.normalizePlace(row));
      const deduplicated = this.removeInternalDuplicates(normalizedRows);
      const existingRows = await sheetsClient.getExistingEntries(
        spreadsheetId,
        input.sheetName,
      );
      const existingKeys = new Set(
        existingRows.map((row) =>
          this.buildDeduplicationKey(
            this.normalizeText(`${row[0] ?? ""}`),
            this.normalizeText(`${row[1] ?? ""}`),
          ),
        ),
      );

      const rowsToInsert = deduplicated.uniqueRows.filter((row) => {
        const deduplicationKey = this.buildDeduplicationKey(row.name, row.address);
        return !existingKeys.has(deduplicationKey);
      });

      const ignoredBySheet = deduplicated.uniqueRows.length - rowsToInsert.length;
      const collectedAt = new Date().toISOString();
      const normalizedSearchTerm = this.normalizeText(input.searchTerm ?? "");
      const values = rowsToInsert.map((row) => [
        collectedAt,
        normalizedSearchTerm,
        row.name,
        row.address,
        row.phone ?? "",
      ]);

      await sheetsClient.appendRows(spreadsheetId, input.sheetName, values);

      logger.info(
        {
          spreadsheetId,
          sheetName: input.sheetName,
          totalCollected: input.rows.length,
          totalInserted: values.length,
          totalIgnored: deduplicated.ignoredDuplicates + ignoredBySheet,
        },
        "Gravacao real concluida",
      );

      return {
        spreadsheetId,
        sheetName: input.sheetName,
        totalCollected: input.rows.length,
        totalInserted: values.length,
        totalIgnored: deduplicated.ignoredDuplicates + ignoredBySheet,
        totalWithError: 0,
        insertedRows: values.length,
        ignoredDuplicates: deduplicated.ignoredDuplicates + ignoredBySheet,
        mode: "google",
        message: "Resultados gravados com sucesso no Google Sheets.",
      };
    } catch (error) {
      logger.error(
        {
          spreadsheetId,
          sheetName: input.sheetName,
          err: error,
        },
        "Falha ao gravar no Google Sheets",
      );

      throw this.toSheetsError(error);
    }
  }

  private normalizePlace(row: WriteSheetsInput["rows"][number]) {
    return {
      ...row,
      name: this.normalizeText(row.name),
      address: this.normalizeText(row.address),
      phone: this.normalizePhone(row.phone),
    };
  }

  private normalizeText(value: string) {
    return value.trim().replace(/\s+/g, " ");
  }

  private normalizePhone(value: string | null) {
    if (!value) {
      return "";
    }

    return this.normalizeText(value);
  }

  private canonicalize(value: string) {
    return this.normalizeText(value)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  }

  private buildDeduplicationKey(name: string, address: string) {
    return `${this.canonicalize(name)}::${this.canonicalize(address)}`;
  }

  private removeInternalDuplicates(rows: WriteSheetsInput["rows"]) {
    const seen = new Set<string>();
    const uniqueRows: WriteSheetsInput["rows"] = [];
    let ignoredDuplicates = 0;

    for (const row of rows) {
      const deduplicationKey = this.buildDeduplicationKey(row.name, row.address);

      if (seen.has(deduplicationKey)) {
        ignoredDuplicates += 1;
        continue;
      }

      seen.add(deduplicationKey);
      uniqueRows.push(row);
    }

    return {
      uniqueRows,
      ignoredDuplicates,
    };
  }

  private toSheetsError(error: unknown) {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(
        `Falha na integracao com Google Sheets: ${error.message}`,
        502,
        "GOOGLE_SHEETS_API_ERROR",
      );
    }

    return new AppError(
      "Falha desconhecida na integracao com Google Sheets.",
      502,
      "GOOGLE_SHEETS_API_ERROR",
    );
  }
}

export const sheetsService = new SheetsService();
