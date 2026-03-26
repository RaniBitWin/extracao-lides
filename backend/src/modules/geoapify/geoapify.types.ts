export type GeoapifyResolvedQuery = {
  initialCategory: string;
  category: string;
  categoryLabel: string;
  categorySource: "dictionary" | "fallback";
  normalizedTokens: string[];
  trustedCategory: boolean;
  relevanceTerms: string[];
  fallbackReason: string | null;
  autoCorrectedCategory: boolean;
  locationQuery: string;
  resolvedAddress: string;
  lat: number;
  lon: number;
  radiusMeters: number;
};

export type GeoapifyPlaceSummary = {
  placeId: string;
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  categories: string[];
};

export type GeoapifyPlaceDetails = {
  phone: string;
  website: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
};

export type GeoapifyPlacesPage = {
  items: GeoapifyPlaceSummary[];
  requestCredits: number;
};

export type GeoapifyPauseKind = "rate_limit" | "quota_limit";
