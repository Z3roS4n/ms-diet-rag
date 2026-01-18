// src/utils/session.ts
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "@/auth";
import type { FastifyRequest } from "fastify";

/**
 * Retrieves the current authentication session based on the provided request.
 *
 * @param request - The incoming request object containing headers.
 * @returns A promise that resolves to the session information.
 */
export async function getSession(request: FastifyRequest) {
  return auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
}
