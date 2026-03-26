import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import type {
  GeoapifyPauseKind,
  GeoapifyPlaceDetails,
  GeoapifyPlaceSummary,
  GeoapifyPlacesPage,
} from "./geoapify.types.js";

type GeocodeResponse = {
  results?: Array<{
    lat?: number;
    lon?: number;
    formatted?: string;
  }>;
};

type PlacesResponse = {
  features?: Array<{
    properties?: Record<string, unknown>;
  }>;
};

type PlaceDetailsResponse = {
  features?: Array<{
    properties?: Record<string, unknown>;
  }>;
};

export class GeoapifyPauseError extends AppError {
  kind: GeoapifyPauseKind;
  retryAfterSeconds: number | null;

  constructor(
    kind: GeoapifyPauseKind,
    message: string,
    statusCode = 429,
    retryAfterSeconds: number | null = null,
  ) {
    super(message, statusCode, "GEOAPIFY_PAUSE_REQUIRED");
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function sleep(ms: number) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function parseRetryAfterSeconds(response: Response) {
  const value = response.headers.get("retry-after");

  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function safeParseResponseBody(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractErrorMessage(data: unknown, status: number) {
  if (data && typeof data === "object") {
    if ("message" in data && typeof data.message === "string") {
      return data.message;
    }

    if ("error" in data && typeof data.error === "string") {
      return data.error;
    }

    if ("description" in data && typeof data.description === "string") {
      return data.description;
    }
  }

  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  return `Geoapify retornou status ${status}.`;
}

function normalizeForMatch(value: string) {
  return value.toLowerCase();
}

function isQuotaExceeded(status: number, normalizedMessage: string) {
  return (
    status === 402 ||
    normalizedMessage.includes("quota") ||
    normalizedMessage.includes("credit") ||
    normalizedMessage.includes("credits") ||
    normalizedMessage.includes("daily limit") ||
    normalizedMessage.includes("daily quota") ||
    normalizedMessage.includes("limit exceeded") ||
    normalizedMessage.includes("out of credits")
  );
}

function isInvalidKeyOrForbidden(status: number, normalizedMessage: string) {
  return (
    status === 401 ||
    (status === 403 &&
      (normalizedMessage.includes("invalid api key") ||
        normalizedMessage.includes("api key is invalid") ||
        normalizedMessage.includes("forbidden") ||
        normalizedMessage.includes("not authorized") ||
        normalizedMessage.includes("unauthorized") ||
        normalizedMessage.includes("access denied") ||
        normalizedMessage.includes("permission denied") ||
        normalizedMessage.includes("api key")))
  );
}

function getString(source: Record<string, unknown> | undefined, key: string) {
  const value = source?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(source: Record<string, unknown> | undefined, key: string) {
  const value = source?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getNestedRecord(source: Record<string, unknown> | undefined, key: string) {
  const value = source?.[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getStringArray(source: Record<string, unknown> | undefined, key: string) {
  const value = source?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function pickFirstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() ?? "";
}

function toSummary(properties: Record<string, unknown> | undefined): GeoapifyPlaceSummary {
  return {
    placeId: getString(properties, "place_id"),
    name: getString(properties, "name"),
    address: getString(properties, "formatted"),
    neighborhood: pickFirstNonEmpty(
      getString(properties, "suburb"),
      getString(properties, "district"),
      getString(properties, "county"),
    ),
    city: pickFirstNonEmpty(getString(properties, "city"), getString(properties, "county")),
    state: getString(properties, "state"),
    postcode: getString(properties, "postcode"),
    latitude: getNumber(properties, "lat"),
    longitude: getNumber(properties, "lon"),
    categories: getStringArray(properties, "categories"),
  };
}

function toDetails(properties: Record<string, unknown> | undefined): GeoapifyPlaceDetails {
  const contact = getNestedRecord(properties, "contact");
  const datasource = getNestedRecord(properties, "datasource");
  const raw = getNestedRecord(datasource, "raw");

  return {
    phone: pickFirstNonEmpty(
      getString(contact, "phone"),
      getString(raw, "phone"),
      getString(raw, "contact:phone"),
    ),
    website: pickFirstNonEmpty(
      getString(properties, "website"),
      getString(contact, "website"),
      getString(raw, "website"),
      getString(raw, "contact:website"),
    ),
    address: pickFirstNonEmpty(
      getString(properties, "formatted"),
      getString(properties, "address_line1"),
    ),
    neighborhood: pickFirstNonEmpty(
      getString(properties, "suburb"),
      getString(properties, "district"),
      getString(properties, "county"),
    ),
    city: pickFirstNonEmpty(getString(properties, "city"), getString(properties, "county")),
    state: getString(properties, "state"),
    postcode: getString(properties, "postcode"),
    latitude: getNumber(properties, "lat"),
    longitude: getNumber(properties, "lon"),
  };
}

export class GeoapifyClient {
  private lastRequestAt = 0;

  private async throttle() {
    const minIntervalMs = Math.ceil(1000 / env.GEOAPIFY_REQUESTS_PER_SECOND);
    const now = Date.now();
    const waitMs = this.lastRequestAt + minIntervalMs - now;

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    this.lastRequestAt = Date.now();
  }

  private getApiKey() {
    if (!env.GEOAPIFY_API_KEY) {
      throw new AppError(
        "GEOAPIFY_API_KEY nao configurada.",
        500,
        "MISSING_GEOAPIFY_API_KEY",
      );
    }

    return env.GEOAPIFY_API_KEY;
  }

  private async requestJson<T>(url: URL, attempt = 0): Promise<T> {
    await this.throttle();

    const response = await fetch(url);
    const retryAfterSeconds = parseRetryAfterSeconds(response);
    const text = await response.text();
    const data = safeParseResponseBody(text);

    if (response.ok) {
      return data as T;
    }

    const message = extractErrorMessage(data, response.status);
    const normalizedMessage = normalizeForMatch(message);

    if (response.status === 429) {
      if (isQuotaExceeded(response.status, normalizedMessage)) {
        throw new GeoapifyPauseError(
          "quota_limit",
          message,
          response.status,
          retryAfterSeconds,
        );
      }

      if (attempt < 2) {
        const waitMs = (retryAfterSeconds ?? attempt + 1) * 1000;
        await sleep(waitMs);
        return this.requestJson<T>(url, attempt + 1);
      }

      throw new GeoapifyPauseError(
        "rate_limit",
        message,
        response.status,
        retryAfterSeconds,
      );
    }

    if (isQuotaExceeded(response.status, normalizedMessage)) {
      throw new GeoapifyPauseError(
        "quota_limit",
        message,
        response.status,
        retryAfterSeconds,
      );
    }

    if (isInvalidKeyOrForbidden(response.status, normalizedMessage)) {
      throw new AppError(
        `Falha de autenticacao/permissao na Geoapify: ${message}`,
        502,
        "GEOAPIFY_AUTH_ERROR",
      );
    }

    if (response.status >= 500 && attempt < 2) {
      await sleep((attempt + 1) * 1000);
      return this.requestJson<T>(url, attempt + 1);
    }

    throw new AppError(
      `Falha na API Geoapify: ${message}`,
      502,
      "GEOAPIFY_API_ERROR",
    );
  }

  async geocode(locationQuery: string) {
    const url = new URL("https://api.geoapify.com/v1/geocode/search");
    url.searchParams.set("text", locationQuery);
    url.searchParams.set("limit", "1");
    url.searchParams.set("format", "json");
    url.searchParams.set("apiKey", this.getApiKey());

    const data = await this.requestJson<GeocodeResponse>(url);
    const firstResult = data.results?.[0];

    if (
      !firstResult ||
      typeof firstResult.lat !== "number" ||
      typeof firstResult.lon !== "number"
    ) {
      throw new AppError(
        `Nao foi possivel localizar a area pesquisada: ${locationQuery}.`,
        400,
        "LOCATION_NOT_FOUND",
      );
    }

    return {
      lat: firstResult.lat,
      lon: firstResult.lon,
      formatted: firstResult.formatted ?? locationQuery,
      requestCredits: 1,
    };
  }

  async searchPlacesPage(params: {
    category: string;
    lat: number;
    lon: number;
    radiusMeters: number;
    offset: number;
    limit: number;
  }): Promise<GeoapifyPlacesPage> {
    const url = new URL("https://api.geoapify.com/v2/places");
    url.searchParams.set("categories", params.category);
    url.searchParams.set(
      "filter",
      `circle:${params.lon},${params.lat},${params.radiusMeters}`,
    );
    url.searchParams.set("bias", `proximity:${params.lon},${params.lat}`);
    url.searchParams.set("limit", String(params.limit));
    url.searchParams.set("offset", String(params.offset));
    url.searchParams.set("apiKey", this.getApiKey());

    const data = await this.requestJson<PlacesResponse>(url);
    const items: GeoapifyPlaceSummary[] = (data.features ?? [])
      .map((feature) => toSummary(feature.properties))
      .filter((item) => item.placeId && item.name && item.address);

    return {
      items,
      requestCredits: Math.max(1, Math.ceil(items.length / 20)),
    };
  }

  async getPlaceDetails(placeId: string) {
    const url = new URL("https://api.geoapify.com/v2/place-details");
    url.searchParams.set("id", placeId);
    url.searchParams.set("apiKey", this.getApiKey());

    const data = await this.requestJson<PlaceDetailsResponse>(url);
    return toDetails(data.features?.[0]?.properties);
  }
}

export const geoapifyClient = new GeoapifyClient();
