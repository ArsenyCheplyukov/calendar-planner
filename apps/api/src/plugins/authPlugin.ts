import fp from "fastify-plugin";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import { TokenManager } from "../infrastructure/google/tokenManager.js";

export interface AuthPluginOptions {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}

declare module "fastify" {
  interface FastifyInstance {
    tokenManager: TokenManager;
  }
  interface FastifyRequest {
    accessToken: string | null;
  }
}

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = fp(
  async (app: FastifyInstance, opts: AuthPluginOptions) => {
    const tokenManager = new TokenManager({
      refreshToken: opts.refreshToken,
      clientId: opts.clientId,
      clientSecret: opts.clientSecret,
    });

    app.decorate("tokenManager", tokenManager);
    app.decorateRequest("accessToken", null);

    app.addHook("onRequest", async (req: FastifyRequest) => {
      req.accessToken = await tokenManager.getAccessToken();
    });
  },
  { name: "auth" },
);

export default authPlugin;
