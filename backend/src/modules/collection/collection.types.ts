export type CollectionInput = {
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

export type CollectionResult = {
  runId: string;
  searchTerm: string;
  maxResults: number;
  spreadsheetId: string;
  sheetName: string;
  totalCollected: number;
  items: CollectedPlace[];
  source: "mock" | "google";
};
