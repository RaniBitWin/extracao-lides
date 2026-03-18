import type { CollectedPlace } from "../collection/collection.types.js";

export type WriteSheetsInput = {
  spreadsheetId: string;
  sheetName: string;
  rows: CollectedPlace[];
};

export type WriteSheetsResult = {
  spreadsheetId: string;
  sheetName: string;
  rowsReceived: number;
  rowsWritten: number;
  mode: "mock" | "google";
  message: string;
};
