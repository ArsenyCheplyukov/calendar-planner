import type { FastifyInstance } from "fastify";

export async function healthAuthRoute(app: FastifyInstance): Promise<void> {
  app.get("/api/health/auth", async (req, reply) => {
    if (!req.accessToken) {
      return reply.status(401).send({
        error: "unauthenticated",
        message: "No refresh token. Run `npm run auth` to bootstrap.",
      });
    }
    return { authenticated: true };
  });
}
