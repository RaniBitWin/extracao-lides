import { google, sheets_v4 } from "googleapis";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEET_HEADERS = [
  "DATA_COLETA",
  "TERMO_BUSCA",
  "NOME",
  "ENDERECO",
  "TELEFONE",
] as const;

function getSheetRange(sheetName: string, range: string) {
  const escapedSheetName = sheetName.replace(/'/g, "''");
  return `'${escapedSheetName}'!${range}`;
}

export class SheetsClient {
  private sheetsApi?: sheets_v4.Sheets;

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

  async ensureSheetInitialized(spreadsheetId: string, sheetName: string) {
    const sheetsApi = await this.getSheetsApi();
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
      range: getSheetRange(sheetName, "A1:E1"),
    });

    const firstRow = headerResponse.data.values?.[0] ?? [];
    const isHeaderMissing =
      firstRow.length === 0 || firstRow.every((cell) => `${cell}`.trim() === "");

    if (isHeaderMissing) {
      await sheetsApi.spreadsheets.values.update({
        spreadsheetId,
        range: getSheetRange(sheetName, "A1:E1"),
        valueInputOption: "RAW",
        requestBody: {
          values: [Array.from(SHEET_HEADERS)],
        },
      });
    }
  }

  async getExistingEntries(spreadsheetId: string, sheetName: string) {
    const sheetsApi = await this.getSheetsApi();
    const response = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: getSheetRange(sheetName, "C2:D"),
    });

    return response.data.values ?? [];
  }

  async appendRows(spreadsheetId: string, sheetName: string, values: string[][]) {
    if (values.length === 0) {
      return;
    }

    const sheetsApi = await this.getSheetsApi();

    await sheetsApi.spreadsheets.values.append({
      spreadsheetId,
      range: getSheetRange(sheetName, "A:E"),
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values,
      },
    });
  }
}

export const sheetsClient = new SheetsClient();
