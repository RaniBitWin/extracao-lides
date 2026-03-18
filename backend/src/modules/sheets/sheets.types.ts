import type { CollectedPlace } from "../collection/collection.types.js";

export type WriteSheetsInput = {
  spreadsheetId?: string;
  sheetName: string;
  searchTerm?: string;
  rows: CollectedPlace[];
};

export type WriteSheetsResult = {
  spreadsheetId: string;
  sheetName: string;
  totalCollected: number;
  totalInserted: number;
  totalIgnored: number;
  totalWithError: number;
  insertedRows: number;
  ignoredDuplicates: number;
  mode: "mock" | "google";
  message: string;
};
