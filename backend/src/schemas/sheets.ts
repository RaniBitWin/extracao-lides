import { z } from "zod";

export const sheetsWriteRequestSchema = z.object({
  spreadsheetId: z
    .string()
    .trim()
    .min(5, "Informe um ID de planilha valido."),
  sheetName: z.string().trim().min(1, "Informe o nome da aba."),
  rows: z
    .array(
      z.object({
        placeId: z.string().trim().min(1, "placeId obrigatorio."),
        name: z.string().trim().min(1, "name obrigatorio."),
        address: z.string().trim().min(1, "address obrigatorio."),
        phone: z.string().trim().nullable(),
      }),
    )
    .min(1, "Envie ao menos um item para gravacao."),
});
