import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { sheetsClient } from "../sheets/sheets.client.js";
import type {
  GeneratedRoute,
  RouteGenerationInput,
  RouteGenerationResponse,
  RouteLead,
} from "./routes.types.js";

type LoggerLike = {
  info: (payload: object, message?: string) => void;
  error: (payload: object, message?: string) => void;
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeComparable(value: string) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function haversineDistanceKm(
  firstLat: number,
  firstLon: number,
  secondLat: number,
  secondLon: number,
) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(secondLat - firstLat);
  const deltaLon = toRadians(secondLon - firstLon);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(firstLat)) *
      Math.cos(toRadians(secondLat)) *
      Math.sin(deltaLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildGoogleMapsLink(stops: RouteLead[]) {
  const coordinates = stops.map(
    (stop) => `${stop.latitude.toFixed(6)},${stop.longitude.toFixed(6)}`,
  );

  return `https://www.google.com/maps/dir/${coordinates.join("/")}`;
}

function slugify(value: string) {
  return normalizeComparable(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function parseDecimalCoordinate(value: unknown) {
  const rawValue = `${value ?? ""}`.trim();

  if (!rawValue) {
    return null;
  }

  const normalizedValue = rawValue.replace(",", ".");
  const parsed = Number(normalizedValue);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return Number(parsed.toFixed(6));
}

export class RoutesService {
  async generateRoutes(
    input: RouteGenerationInput,
    logger: LoggerLike,
  ): Promise<RouteGenerationResponse> {
    const spreadsheetId = input.spreadsheetId ?? env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      throw new AppError(
        "Informe spreadsheetId na requisicao ou configure GOOGLE_SHEET_ID.",
        400,
        "MISSING_SPREADSHEET_ID",
      );
    }

    logger.info(
      {
        spreadsheetId,
        sheetName: input.sheetName,
        city: input.city ?? null,
        neighborhood: input.neighborhood ?? null,
        groupSize: input.groupSize,
      },
      "Rotas: iniciando geracao real a partir da planilha",
    );

    await sheetsClient.ensureSheetInitialized(spreadsheetId, input.sheetName, logger);
    const rawRows = await sheetsClient.getSheetRows(spreadsheetId, input.sheetName);
    const parsedLeads = this.parseRows(rawRows);
    const filteredLeads = this.filterEligibleLeads(parsedLeads, input);
    const routes = this.buildRoutes(filteredLeads, input.groupSize);

    logger.info(
      {
        spreadsheetId,
        sheetName: input.sheetName,
        totalRowsRead: rawRows.length,
        totalEligibleLeads: filteredLeads.length,
        totalRoutes: routes.length,
      },
      "Rotas: geracao concluida",
    );

    return {
      status: "success",
      totalEligibleLeads: filteredLeads.length,
      totalRoutes: routes.length,
      routes,
    };
  }

  private parseRows(rows: unknown[][]) {
    return rows
      .map((row) => ({
        name: normalizeText(`${row[2] ?? ""}`),
        address: normalizeText(`${row[3] ?? ""}`),
        neighborhood: normalizeText(`${row[4] ?? ""}`),
        city: normalizeText(`${row[5] ?? ""}`),
        phone: normalizeText(`${row[8] ?? ""}`),
        website: normalizeText(`${row[9] ?? ""}`),
        latitude: this.parseCoordinate(row[10]),
        longitude: this.parseCoordinate(row[11]),
        status: normalizeText(`${row[14] ?? ""}`),
        placeId: normalizeText(`${row[13] ?? ""}`),
        runId: normalizeText(`${row[15] ?? ""}`),
      }))
      .filter((row) => row.name && row.address);
  }

  private parseCoordinate(value: unknown) {
    return parseDecimalCoordinate(value);
  }

  private filterEligibleLeads(
    leads: Array<Omit<RouteLead, "latitude" | "longitude"> & { latitude: number | null; longitude: number | null }>,
    input: RouteGenerationInput,
  ): RouteLead[] {
    const requestedCity = normalizeComparable(input.city ?? "");
    const requestedNeighborhood = normalizeComparable(input.neighborhood ?? "");

    return leads.filter((lead): lead is RouteLead => {
      if (lead.latitude === null || lead.longitude === null) {
        return false;
      }

      const sameCity =
        !requestedCity || normalizeComparable(lead.city) === requestedCity;
      const sameNeighborhood =
        !requestedNeighborhood ||
        normalizeComparable(lead.neighborhood) === requestedNeighborhood;

      return sameCity && sameNeighborhood;
    });
  }

  private buildRoutes(leads: RouteLead[], groupSize: number) {
    const groupedByRegion = new Map<string, RouteLead[]>();

    for (const lead of leads) {
      const key = `${normalizeComparable(lead.city)}::${normalizeComparable(lead.neighborhood || "sem bairro")}`;
      const current = groupedByRegion.get(key) ?? [];
      current.push(lead);
      groupedByRegion.set(key, current);
    }

    const routes: GeneratedRoute[] = [];

    groupedByRegion.forEach((group) => {
      const orderedGroup = [...group].sort((left, right) =>
        left.name.localeCompare(right.name),
      );

      for (let index = 0; index < orderedGroup.length; index += groupSize) {
        const chunk = orderedGroup.slice(index, index + groupSize);
        const orderedVisits = this.orderByNearestNeighbor(chunk);
        const city = orderedVisits[0]?.city ?? "";
        const predominantNeighborhood = this.getPredominantNeighborhood(orderedVisits);
        const routeIndex = Math.floor(index / groupSize) + 1;

        routes.push({
          routeId: `${slugify(city || "rota")}-${slugify(predominantNeighborhood || "sem-bairro")}-${routeIndex}`,
          city,
          predominantNeighborhood,
          stopCount: orderedVisits.length,
          estimatedDistanceKm: this.estimateDistance(orderedVisits),
          visits: orderedVisits,
          externalLink: buildGoogleMapsLink(orderedVisits),
        });
      }
    });

    return routes.sort((left, right) => {
      if (left.city !== right.city) {
        return left.city.localeCompare(right.city);
      }

      return left.predominantNeighborhood.localeCompare(right.predominantNeighborhood);
    });
  }

  private orderByNearestNeighbor(stops: RouteLead[]) {
    if (stops.length <= 2) {
      return [...stops];
    }

    const unvisited = [...stops];
    const ordered: RouteLead[] = [];
    let current = unvisited.shift()!;
    ordered.push(current);

    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      unvisited.forEach((candidate, index) => {
        const distance = haversineDistanceKm(
          current.latitude,
          current.longitude,
          candidate.latitude,
          candidate.longitude,
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      current = unvisited.splice(nearestIndex, 1)[0];
      ordered.push(current);
    }

    return ordered;
  }

  private estimateDistance(stops: RouteLead[]) {
    let totalDistance = 0;

    for (let index = 1; index < stops.length; index += 1) {
      totalDistance += haversineDistanceKm(
        stops[index - 1].latitude,
        stops[index - 1].longitude,
        stops[index].latitude,
        stops[index].longitude,
      );
    }

    return Number(totalDistance.toFixed(1));
  }

  private getPredominantNeighborhood(stops: RouteLead[]) {
    const counts = new Map<string, number>();

    stops.forEach((stop) => {
      const neighborhood = stop.neighborhood || "Nao informado";
      counts.set(neighborhood, (counts.get(neighborhood) ?? 0) + 1);
    });

    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "Nao informado";
  }
}

export const routesService = new RoutesService();
