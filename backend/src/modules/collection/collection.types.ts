export type CollectionInput = {
  searchTerm: string;
  city: string;
  state: string;
  maxResults: number;
  spreadsheetId?: string;
  sheetName: string;
};

export type CollectedPlace = {
  placeId: string;
  runId: string;
  collectedAt: string;
  searchTerm: string;
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  postcode: string;
  phone: string;
  website: string;
  latitude: number | null;
  longitude: number | null;
  source: "geoapify";
  status: "coletado" | "duplicado" | "ignorado" | "erro";
};

export type PauseReason =
  | "daily_credit_limit_estimated"
  | "geoapify_rate_limit"
  | "geoapify_quota_exceeded"
  | null;

export type PauseDecision = "continue_next_day" | "wait_for_paid_plan" | null;

export type CollectionStatus = "running" | "paused" | "completed" | "failed";

export type CollectionRunState = {
  runId: string;
  searchTerm: string;
  city: string;
  state: string;
  maxResults: number;
  spreadsheetId?: string;
  sheetName: string;
  source: "geoapify";
  status: CollectionStatus;
  pauseReason: PauseReason;
  pauseDecision: PauseDecision;
  failureType: "auth_error" | "integration_error" | null;
  canResume: boolean;
  message: string;
  nextOffset: number;
  pageSize: number;
  radiusStageIndex: number;
  currentRadiusMeters: number;
  estimatedCreditsUsed: number;
  estimatedCreditsLimit: number;
  estimatedCreditsRemaining: number;
  estimatedCreditsGeocoding: number;
  estimatedCreditsSearch: number;
  estimatedCreditsDetails: number;
  totalInserted: number;
  totalIgnored: number;
  totalWithError: number;
  totalCollected: number;
  recentItems: CollectedPlace[];
  seenPlaceIds: string[];
  geoapifyCategory: string | null;
  geoapifyCategoryLabel: string | null;
  geoapifyCategoryTrusted: boolean;
  geoapifyRelevanceTerms: string[];
  locationQuery: string | null;
  resolvedLocation: string | null;
  latitude: number | null;
  longitude: number | null;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export type CollectionDecisionInput = {
  runId: string;
  decision: Exclude<PauseDecision, null>;
};

export type CollectionResumeInput = {
  runId: string;
};

export type CollectionResponse = CollectionRunState & {
  items: CollectedPlace[];
};
