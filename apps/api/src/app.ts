import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
    },
  });

  await app.register(cors, {
    origin: true,
  });

  app.get("/api/health", async () => {
    return { status: "ok" };
  });

  return app;
}
