import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import { AppError } from "./lib/errors.js";
import { registerRoutes } from "./routes/index.js";

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === "development"
        ? {
            transport: {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss",
                ignore: "pid,hostname",
              },
            },
          }
        : true,
  });

  await app.register(cors, {
    origin: env.FRONTEND_ORIGIN,
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      request.log.warn(
        {
          code: error.code,
          statusCode: error.statusCode,
          message: error.message,
        },
        "Erro tratado na aplicacao",
      );

      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
      });
    }

    request.log.error(
      {
        err: error,
      },
      "Erro inesperado no servidor",
    );

    return reply.status(500).send({
      code: "INTERNAL_SERVER_ERROR",
      message: "Ocorreu um erro inesperado no servidor.",
    });
  });

  await registerRoutes(app);

  return app;
}
