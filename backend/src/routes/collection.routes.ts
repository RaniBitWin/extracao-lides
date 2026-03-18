import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { collectionService } from "../modules/collection/collection.service.js";
import { collectionRequestSchema } from "../schemas/collection.js";
import { toValidationError } from "../lib/validation.js";

export async function registerCollectionRoutes(app: FastifyInstance) {
  app.post("/api/collection/start", async (request, reply) => {
    try {
      const payload = collectionRequestSchema.parse(request.body);
      const result = await collectionService.startCollection(payload, request.log);

      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof ZodError) {
        throw toValidationError(error);
      }

      throw error;
    }
  });
}
