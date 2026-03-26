import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { sheetsService } from "../modules/sheets/sheets.service.js";
import { sheetsWriteRequestSchema } from "../schemas/sheets.js";
import { toValidationError } from "../lib/validation.js";

export async function registerSheetsRoutes(app: FastifyInstance) {
  app.post("/api/sheets/write", async (request, reply) => {
    try {
      const payload = sheetsWriteRequestSchema.parse(request.body);
      const rows = payload.rows.map((row) => ({
        placeId: row.placeId,
        runId: row.runId,
        collectedAt: row.collectedAt || new Date().toISOString(),
        searchTerm: row.searchTerm || payload.searchTerm,
        name: row.name,
        address: row.address,
        neighborhood: row.neighborhood,
        city: row.city,
        state: row.state,
        postcode: row.postcode,
        phone: row.phone ?? "",
        website: row.website,
        latitude: row.latitude,
        longitude: row.longitude,
        source: row.source,
        status: row.status,
      }));
      const result = await sheetsService.writeRows(
        {
          ...payload,
          rows,
        },
        request.log,
      );

      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof ZodError) {
        throw toValidationError(error);
      }

      throw error;
    }
  });
}
