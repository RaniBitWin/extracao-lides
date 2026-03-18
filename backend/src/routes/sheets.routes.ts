import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { sheetsService } from "../modules/sheets/sheets.service.js";
import { sheetsWriteRequestSchema } from "../schemas/sheets.js";
import { toValidationError } from "../lib/validation.js";

export async function registerSheetsRoutes(app: FastifyInstance) {
  app.post("/api/sheets/write", async (request, reply) => {
    try {
      const payload = sheetsWriteRequestSchema.parse(request.body);
      const result = await sheetsService.writeRows(payload, request.log);

      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof ZodError) {
        throw toValidationError(error);
      }

      throw error;
    }
  });
}
