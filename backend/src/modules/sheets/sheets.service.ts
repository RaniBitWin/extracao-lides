import { google } from "googleapis";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import type { WriteSheetsInput, WriteSheetsResult } from "./sheets.types.js";

type LoggerLike = {
  info: (payload: object, message?: string) => void;
};

export class SheetsService {
  async writeRows(
    input: WriteSheetsInput,
    logger: LoggerLike,
  ): Promise<WriteSheetsResult> {
    logger.info(
      {
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
        rowsReceived: input.rows.length,
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

    if (env.COLLECTION_MOCK_MODE) {
      logger.info(
        {
          spreadsheetId: input.spreadsheetId,
          sheetName: input.sheetName,
          rowsWritten: input.rows.length,
        },
        "Gravacao simulada concluida",
      );

      return {
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
        rowsReceived: input.rows.length,
        rowsWritten: input.rows.length,
        mode: "mock",
        message: "Modo mock ativo: resultados validados e simulados para gravacao.",
      };
    }

    if (
      !env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
      !env.GOOGLE_PROJECT_ID
    ) {
      throw new AppError(
        "Credenciais do Google Sheets nao configuradas para gravacao real.",
        500,
        "MISSING_SHEETS_CREDENTIALS",
      );
    }

    const auth = new google.auth.JWT({
      email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
      projectId: env.GOOGLE_PROJECT_ID,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const values = input.rows.map((row) => [
      row.placeId,
      row.name,
      row.address,
      row.phone ?? "",
      new Date().toISOString(),
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: input.spreadsheetId,
      range: `${input.sheetName}!A:E`,
      valueInputOption: "RAW",
      requestBody: {
        values,
      },
    });

    logger.info(
      {
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
        rowsWritten: values.length,
      },
      "Gravacao real concluida",
    );

    return {
      spreadsheetId: input.spreadsheetId,
      sheetName: input.sheetName,
      rowsReceived: input.rows.length,
      rowsWritten: values.length,
      mode: "google",
      message: "Resultados gravados com sucesso no Google Sheets.",
    };
  }
}

export const sheetsService = new SheetsService();
