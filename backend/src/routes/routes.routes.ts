import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { toValidationError } from "../lib/validation.js";
import { routesService } from "../modules/routes/routes.service.js";
import { routesGenerateRequestSchema } from "../schemas/routes.js";

export async function registerLogisticsRoutes(app: FastifyInstance) {
  app.post("/api/routes/generate", async (request, reply) => {
    try {
      const payload = routesGenerateRequestSchema.parse(request.body);
      const result = await routesService.generateRoutes(payload, request.log);

      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof ZodError) {
        throw toValidationError(error);
      }

      throw error;
    }
  });
}
