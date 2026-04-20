export type RouteGenerationInput = {
  spreadsheetId?: string;
  sheetName: string;
  city?: string;
  neighborhood?: string;
  groupSize: number;
};

export type RouteLead = {
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  phone: string;
  website: string;
  latitude: number;
  longitude: number;
  status: string;
  placeId: string;
  runId: string;
};

export type GeneratedRoute = {
  routeId: string;
  city: string;
  predominantNeighborhood: string;
  stopCount: number;
  estimatedDistanceKm: number;
  visits: RouteLead[];
  externalLink: string;
};

export type RouteGenerationResponse = {
  status: "success";
  totalEligibleLeads: number;
  totalRoutes: number;
  routes: GeneratedRoute[];
};
