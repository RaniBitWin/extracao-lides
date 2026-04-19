import type { CollectedPlace, RoutePlan } from "../types/api";

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
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

function estimateDistanceKm(stops: CollectedPlace[]) {
  let total = 0;

  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1];
    const current = stops[index];

    if (
      previous.latitude === null ||
      previous.longitude === null ||
      current.latitude === null ||
      current.longitude === null
    ) {
      continue;
    }

    total += haversineDistanceKm(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude,
    );
  }

  return Number(total.toFixed(1));
}

function buildExternalRouteLink(stops: CollectedPlace[]) {
  const coordinates = stops
    .filter((stop) => stop.latitude !== null && stop.longitude !== null)
    .map((stop) => `${formatCoordinate(stop.latitude!)},${formatCoordinate(stop.longitude!)}`);

  if (coordinates.length < 2) {
    return "";
  }

  return `https://www.google.com/maps/dir/${coordinates.join("/")}`;
}

function getPredominantNeighborhood(stops: CollectedPlace[]) {
  const counts = new Map<string, number>();

  stops.forEach((stop) => {
    const neighborhood = stop.neighborhood.trim() || "Nao informado";
    counts.set(neighborhood, (counts.get(neighborhood) ?? 0) + 1);
  });

  const winner = Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0];
  return winner?.[0] ?? "Nao informado";
}

function orderStops(stops: CollectedPlace[]) {
  return [...stops].sort((left, right) => {
    const leftNeighborhood = normalizeText(left.neighborhood || "");
    const rightNeighborhood = normalizeText(right.neighborhood || "");

    if (leftNeighborhood !== rightNeighborhood) {
      return leftNeighborhood.localeCompare(rightNeighborhood);
    }

    return normalizeText(left.name).localeCompare(normalizeText(right.name));
  });
}

export function buildRoutePlans(input: {
  items: CollectedPlace[];
  cityFilter: string;
  neighborhoodFilter: string;
  groupSize: number;
}) {
  const sanitizedGroupSize = Math.max(1, input.groupSize);
  const filteredItems = input.items.filter((item) => {
    const matchesCity =
      !input.cityFilter ||
      normalizeText(item.city) === normalizeText(input.cityFilter);
    const matchesNeighborhood =
      !input.neighborhoodFilter ||
      normalizeText(item.neighborhood) === normalizeText(input.neighborhoodFilter);

    return matchesCity && matchesNeighborhood;
  });

  const groupedByRegion = new Map<string, CollectedPlace[]>();

  filteredItems.forEach((item) => {
    const key = `${normalizeText(item.city)}::${normalizeText(item.neighborhood || "nao informado")}`;
    const current = groupedByRegion.get(key) ?? [];
    current.push(item);
    groupedByRegion.set(key, current);
  });

  const routes: RoutePlan[] = [];

  groupedByRegion.forEach((group) => {
    const orderedStops = orderStops(group);

    for (let index = 0; index < orderedStops.length; index += sanitizedGroupSize) {
      const chunk = orderedStops.slice(index, index + sanitizedGroupSize);
      const city = chunk[0]?.city ?? "";
      const predominantNeighborhood = getPredominantNeighborhood(chunk);
      const routeId = `${city || "rota"}-${predominantNeighborhood}-${Math.floor(index / sanitizedGroupSize) + 1}`
        .toLowerCase()
        .replace(/\s+/g, "-");

      routes.push({
        id: routeId,
        city,
        predominantNeighborhood,
        stopCount: chunk.length,
        estimatedDistanceKm: estimateDistanceKm(chunk),
        stops: chunk,
        externalLink: buildExternalRouteLink(chunk),
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
