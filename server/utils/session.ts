// src/utils/session.ts
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "@/auth";

/**
 * Retrieves the current authentication session based on the provided request.
 *
 * @param request - The incoming request object containing headers.
 * @returns A promise that resolves to the session information.
 */
export async function getSession(request: any) {
  return auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
}
