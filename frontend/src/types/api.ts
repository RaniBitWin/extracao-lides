export type CollectionRequest = {
  searchTerm: string;
  maxResults: number;
  spreadsheetId: string;
  sheetName: string;
};

export type CollectedPlace = {
  placeId: string;
  name: string;
  address: string;
  phone: string | null;
};

export type CollectionResponse = {
  runId: string;
  searchTerm: string;
  maxResults: number;
  spreadsheetId: string;
  sheetName: string;
  totalCollected: number;
  items: CollectedPlace[];
  source: "mock" | "google";
};

export type WriteSheetsRequest = {
  spreadsheetId: string;
  sheetName: string;
  rows: CollectedPlace[];
};

export type WriteSheetsResponse = {
  spreadsheetId: string;
  sheetName: string;
  rowsReceived: number;
  rowsWritten: number;
  mode: "mock" | "google";
  message: string;
};
