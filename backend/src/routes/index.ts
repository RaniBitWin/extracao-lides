import type { FastifyInstance } from "fastify";
import { registerCollectionRoutes } from "./collection.routes.js";
import { registerLogisticsRoutes } from "./routes.routes.js";
import { registerSheetsRoutes } from "./sheets.routes.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  await registerCollectionRoutes(app);
  await registerLogisticsRoutes(app);
  await registerSheetsRoutes(app);
}
