import { buildApp } from "./app.js";
import { env } from "./config/env.js";

async function start() {
  const app = await buildApp();

  try {
    await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });

    app.log.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        mockMode: env.COLLECTION_MOCK_MODE,
      },
      "Servidor iniciado",
    );
  } catch (error) {
    app.log.error({ err: error }, "Falha ao iniciar o backend");
    process.exit(1);
  }
}

start();
