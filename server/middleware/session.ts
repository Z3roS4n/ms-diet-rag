import { getSession } from "@/utils/session";
import type { FastifyReply, FastifyRequest } from "fastify";

export async function sessionMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const session = await getSession(request);
  if(!session || !session.user) {
    reply.status(401).send({ error: "Unauthorized" });
    return;
  }

  request.session = session;
}