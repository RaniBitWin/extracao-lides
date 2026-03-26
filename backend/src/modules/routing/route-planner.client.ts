import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import type { RoutePlannerRequest } from "./routing.types.js";

export class RoutePlannerClient {
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

  buildPlannerUrl() {
    const url = new URL("https://api.geoapify.com/v1/routeplanner");
    url.searchParams.set("apiKey", this.getApiKey());
    return url.toString();
  }

  buildPayload(request: RoutePlannerRequest) {
    return {
      mode: "drive",
      agents: request.agents.map((agent) => ({
        location: [agent.longitude, agent.latitude],
      })),
      jobs: request.jobs.map((job) => ({
        location: [job.longitude, job.latitude],
      })),
    };
  }
}

export const routePlannerClient = new RoutePlannerClient();
