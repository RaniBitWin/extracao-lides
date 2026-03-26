import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import type { RoutingRequest } from "./routing.types.js";

export class RoutingClient {
  private getApiKey() {
    if (!env.GEOAPIFY_API_KEY) {
      throw new AppError(
        "GEOAPIFY_API_KEY nao configurada para o subprojeto de roteirizacao.",
        500,
        "MISSING_GEOAPIFY_API_KEY",
      );
    }

    return env.GEOAPIFY_API_KEY;
  }

  buildRoutingUrl(request: RoutingRequest) {
    const url = new URL("https://api.geoapify.com/v1/routing");
    const waypoints = request.waypoints
      .map((waypoint) => `${waypoint.longitude},${waypoint.latitude}`)
      .join("|");

    url.searchParams.set("waypoints", waypoints);
    url.searchParams.set("mode", request.mode);
    url.searchParams.set("apiKey", this.getApiKey());

    return url.toString();
  }
}

export const routingClient = new RoutingClient();
