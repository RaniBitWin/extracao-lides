import { google, sheets_v4 } from "googleapis";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEET_HEADERS = [
  "DATA_COLETA",
  "TERMO_BUSCA",
  "NOME",
  "ENDERECO",
  "BAIRRO",
  "CIDADE",
  "ESTADO",
  "CEP",
  "TELEFONE",
  "WEBSITE",
  "LATITUDE",
  "LONGITUDE",
  "FONTE",
  "PLACE_ID",
  "STATUS_COLETA",
  "RUN_ID",
] as const;
const EXPECTED_HEADER_RANGE = "A1:P1";

function getSheetRange(sheetName: string, range: string) {
  const escapedSheetName = sheetName.replace(/'/g, "''");
  return `'${escapedSheetName}'!${range}`;
}

export class SheetsClient {
  private sheetsApi?: sheets_v4.Sheets;

  private logInfo(
    logger: { info: (payload: object, message?: string) => void } | undefined,
    payload: object,
    message: string,
  ) {
    if (logger) {
      logger.info(payload, message);
      return;
    }

    console.log(message, payload);
  }

  async getSheetsApi() {
    if (this.sheetsApi) {
      return this.sheetsApi;
    }

    if (env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH) {
      const auth = new google.auth.GoogleAuth({
        keyFile: env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH,
        scopes: [SHEETS_SCOPE],
      });

      this.sheetsApi = google.sheets({ version: "v4", auth });
      return this.sheetsApi;
    }

    if (!env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
      throw new AppError(
        "Configure GOOGLE_SERVICE_ACCOUNT_JSON_PATH ou GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY.",
        500,
        "MISSING_GOOGLE_SHEETS_AUTH",
      );
    }

    const auth = new google.auth.JWT({
      email: env.GOOGLE_CLIENT_EMAIL,
      key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      scopes: [SHEETS_SCOPE],
    });

    this.sheetsApi = google.sheets({ version: "v4", auth });
    return this.sheetsApi;
  }

  async ensureSheetInitialized(
    spreadsheetId: string,
    sheetName: string,
    logger?: { info: (payload: object, message?: string) => void },
  ) {
    const sheetsApi = await this.getSheetsApi();
    this.logInfo(
      logger,
      {
        spreadsheetId,
        sheetName,
      },
      "Sheets: entrando em ensureSheetInitialized",
    );
    const spreadsheet = await sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties",
    });

    const existingSheet = spreadsheet.data.sheets?.find(
      (sheet) => sheet.properties?.title === sheetName,
    );

    if (!existingSheet) {
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });
    }

    const headerResponse = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: getSheetRange(sheetName, EXPECTED_HEADER_RANGE),
    });

    const firstRow = headerResponse.data.values?.[0] ?? [];
    const normalizedExistingHeaders = this.normalizeHeaderRow(firstRow);
    const normalizedExpectedHeaders = Array.from(SHEET_HEADERS);
    this.logInfo(
      logger,
      {
        spreadsheetId,
        sheetName,
        currentHeader: normalizedExistingHeaders,
        expectedHeader: normalizedExpectedHeaders,
      },
      "Sheets: header lido e schema esperado",
    );
    const shouldRewriteHeaders =
      normalizedExistingHeaders.length !== normalizedExpectedHeaders.length ||
      normalizedExpectedHeaders.some(
        (header, index) => normalizedExistingHeaders[index] !== header,
      );

    if (shouldRewriteHeaders) {
      this.logInfo(
        logger,
        {
          spreadsheetId,
          sheetName,
          shouldRewriteHeaders,
        },
        "Sheets: header divergente, reescrevendo A1:P1",
      );
      await this.rewriteHeaderRow(spreadsheetId, sheetName, normalizedExpectedHeaders);
      this.logInfo(
        logger,
        {
          spreadsheetId,
          sheetName,
          rewrittenHeader: normalizedExpectedHeaders,
        },
        "Sheets: header reescrito com sucesso",
      );
      return;
    }

    this.logInfo(
      logger,
      {
        spreadsheetId,
        sheetName,
        shouldRewriteHeaders,
      },
      "Sheets: header ja estava alinhado com o schema esperado",
    );
  }

  private normalizeHeaderRow(row: unknown[]) {
    return Array.from({ length: SHEET_HEADERS.length }, (_, index) => `${row[index] ?? ""}`.trim());
  }

  private async rewriteHeaderRow(
    spreadsheetId: string,
    sheetName: string,
    expectedHeaders: string[],
  ) {
    const sheetsApi = await this.getSheetsApi();
    const headerRange = getSheetRange(sheetName, EXPECTED_HEADER_RANGE);

    await sheetsApi.spreadsheets.values.clear({
      spreadsheetId,
      range: headerRange,
    });

    await sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: "RAW",
      requestBody: {
        majorDimension: "ROWS",
        values: [expectedHeaders],
      },
    });

    const verification = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: headerRange,
    });
    const writtenHeaders = this.normalizeHeaderRow(verification.data.values?.[0] ?? []);
    const headerMatches = expectedHeaders.every(
      (header, index) => writtenHeaders[index] === header,
    );

    if (!headerMatches) {
      throw new AppError(
        "Falha ao normalizar o cabecalho da aba no Google Sheets.",
        502,
        "GOOGLE_SHEETS_HEADER_MISMATCH",
      );
    }
  }

  async getNextWriteRow(spreadsheetId: string, sheetName: string) {
    const sheetsApi = await this.getSheetsApi();
    const response = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: getSheetRange(sheetName, "A:P"),
    });

    const rows = response.data.values ?? [];
    let lastRowWithData = 0;

    rows.forEach((row, index) => {
      const hasData = row.some((cell) => `${cell ?? ""}`.trim() !== "");

      if (hasData) {
        lastRowWithData = index + 1;
      }
    });

    return Math.max(lastRowWithData + 1, 2);
  }

  async getExistingEntries(spreadsheetId: string, sheetName: string) {
    const sheetsApi = await this.getSheetsApi();
    const response = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: getSheetRange(sheetName, "C2:D"),
    });

    return response.data.values ?? [];
  }

  async appendRows(spreadsheetId: string, sheetName: string, values: Array<Array<string | number>>) {
    if (values.length === 0) {
      return;
    }

    const sheetsApi = await this.getSheetsApi();
    const nextWriteRow = await this.getNextWriteRow(spreadsheetId, sheetName);
    const normalizedValues = values.map((row) => {
      const normalizedRow = Array.from({ length: SHEET_HEADERS.length }, (_, index) => row[index] ?? "");
      return normalizedRow;
    });
    const endWriteRow = nextWriteRow + normalizedValues.length - 1;

    await sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range: getSheetRange(sheetName, `A${nextWriteRow}:P${endWriteRow}`),
      valueInputOption: "RAW",
      requestBody: {
        values: normalizedValues,
      },
    });
  }
}

export const sheetsClient = new SheetsClient();
