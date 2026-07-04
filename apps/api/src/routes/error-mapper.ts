import type { FastifyReply } from "fastify";

export type RouteErrorCode =
  | "bad_request"
  | "unauthenticated"
  | "upstream_error"
  | "internal_error";

export class RouteError extends Error {
  readonly code: RouteErrorCode;

  constructor(code: RouteErrorCode, message: string) {
    super(message);
    this.name = "RouteError";
    this.code = code;
  }
}

export function badRequest(message: string): RouteError {
  return new RouteError("bad_request", message);
}

export function unauthenticated(message: string): RouteError {
  return new RouteError("unauthenticated", message);
}

export function upstreamError(message: string): RouteError {
  return new RouteError("upstream_error", message);
}

export function internalError(message: string): RouteError {
  return new RouteError("internal_error", message);
}

const STATUS_CODES: Record<RouteErrorCode, number> = {
  bad_request: 400,
  unauthenticated: 401,
  upstream_error: 502,
  internal_error: 500,
};

/**
 * Map a thrown error to a stable HTTP error response.
 *
 * - RouteError instances use their declared code.
 * - Unknown errors are treated as internal failures (500).
 */
export function sendRouteError(
  error: unknown,
  reply: FastifyReply,
): FastifyReply {
  if (error instanceof RouteError) {
    return reply.status(STATUS_CODES[error.code]).send({
      error: error.code,
      message: error.message,
    });
  }

  const message = error instanceof Error ? error.message : String(error);
  return reply.status(500).send({
    error: "internal_error",
    message,
  });
}
