import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { collectionService } from "../modules/collection/collection.service.js";
import {
  collectionDecisionSchema,
  collectionRequestSchema,
  collectionRunIdSchema,
} from "../schemas/collection.js";
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

  app.get("/api/collection/:runId", async (request, reply) => {
    try {
      const params = collectionRunIdSchema.parse(request.params);
      const result = await collectionService.getRun(params.runId);

      return reply.status(200).send({
        ...result,
        items: result.recentItems,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw toValidationError(error);
      }

      throw error;
    }
  });

  app.post("/api/collection/:runId/resume", async (request, reply) => {
    try {
      const params = collectionRunIdSchema.parse(request.params);
      const result = await collectionService.resumeCollection(params.runId, request.log);

      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof ZodError) {
        throw toValidationError(error);
      }

      throw error;
    }
  });

  app.post("/api/collection/:runId/decision", async (request, reply) => {
    try {
      const params = collectionRunIdSchema.parse(request.params);
      const body = collectionDecisionSchema.parse(request.body);
      const result = await collectionService.savePauseDecision({
        runId: params.runId,
        decision: body.decision,
      });

      return reply.status(200).send({
        ...result,
        items: result.recentItems,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw toValidationError(error);
      }

      throw error;
    }
  });
}
