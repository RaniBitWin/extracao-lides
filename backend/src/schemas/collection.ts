import { z } from "zod";

export const collectionRequestSchema = z.object({
  searchTerm: z.string().trim().min(3, "Informe um termo de busca valido."),
  city: z.string().trim().min(2, "Informe a cidade."),
  state: z.string().trim().min(2, "Informe o estado."),
  maxResults: z.coerce
    .number()
    .int()
    .min(1, "O limite minimo e 1.")
    .max(100, "O limite maximo inicial e 100."),
  spreadsheetId: z
    .string()
    .trim()
    .min(5, "Informe um ID de planilha valido.")
    .optional(),
  sheetName: z.string().trim().min(1, "Informe o nome da aba."),
});

export const collectionRunIdSchema = z.object({
  runId: z.string().uuid("Informe um runId valido."),
});

export const collectionDecisionSchema = z.object({
  decision: z.enum(["continue_next_day", "wait_for_paid_plan"]),
});
