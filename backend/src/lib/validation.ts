import { ZodError } from "zod";
import { AppError } from "./errors.js";

export function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function toValidationError(error: ZodError) {
  const details = formatZodError(error)
    .map((item) => `${item.path || "body"}: ${item.message}`)
    .join("; ");

  return new AppError(`Dados invalidos. ${details}`, 400, "VALIDATION_ERROR");
}
