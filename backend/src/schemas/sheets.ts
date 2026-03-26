import { z } from "zod";

export const sheetsWriteRequestSchema = z.object({
  spreadsheetId: z
    .string()
    .trim()
    .min(5, "Informe um ID de planilha valido.")
    .optional(),
  sheetName: z.string().trim().min(1, "Informe o nome da aba."),
  searchTerm: z.string().trim().optional().default(""),
  rows: z
    .array(
      z.object({
        placeId: z.string().trim().min(1, "placeId obrigatorio."),
        runId: z.string().trim().optional().default("manual-run"),
        collectedAt: z.string().trim().optional().default(""),
        searchTerm: z.string().trim().optional().default(""),
        name: z.string().trim().min(1, "name obrigatorio."),
        address: z.string().trim().min(1, "address obrigatorio."),
        neighborhood: z.string().trim().optional().default(""),
        city: z.string().trim().optional().default(""),
        state: z.string().trim().optional().default(""),
        postcode: z.string().trim().optional().default(""),
        phone: z.string().trim().nullable(),
        website: z.string().trim().optional().default(""),
        latitude: z.number().nullable().optional().default(null),
        longitude: z.number().nullable().optional().default(null),
        source: z.literal("geoapify").optional().default("geoapify"),
        status: z
          .enum(["coletado", "duplicado", "ignorado", "erro"])
          .optional()
          .default("coletado"),
      }),
    )
    .min(1, "Envie ao menos um item para gravacao."),
});
