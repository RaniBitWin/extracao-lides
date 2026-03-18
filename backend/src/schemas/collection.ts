import { z } from "zod";

export const collectionRequestSchema = z.object({
  searchTerm: z.string().trim().min(3, "Informe um termo de busca valido."),
  maxResults: z.coerce
    .number()
    .int()
    .min(1, "O limite minimo e 1.")
    .max(100, "O limite maximo inicial e 100."),
  spreadsheetId: z
    .string()
    .trim()
    .min(5, "Informe um ID de planilha valido."),
  sheetName: z.string().trim().min(1, "Informe o nome da aba."),
});
