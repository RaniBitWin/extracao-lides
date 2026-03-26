export type RoutingWaypoint = {
  id: string;
  latitude: number;
  longitude: number;
  label?: string;
};

export type RoutingRequest = {
  mode: "drive" | "truck" | "walk" | "bicycle";
  waypoints: RoutingWaypoint[];
};

export type RoutePlannerJob = {
  id: string;
  latitude: number;
  longitude: number;
  label?: string;
};

export type RoutePlannerRequest = {
  agents: RoutingWaypoint[];
  jobs: RoutePlannerJob[];
};
