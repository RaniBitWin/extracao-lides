import { z } from "zod";

export const routesGenerateRequestSchema = z.object({
  spreadsheetId: z.string().trim().optional(),
  sheetName: z.string().trim().min(1, "Informe o nome da aba."),
  city: z.string().trim().optional(),
  neighborhood: z.string().trim().optional(),
  groupSize: z.coerce.number().int().min(1).max(12).default(12),
});
