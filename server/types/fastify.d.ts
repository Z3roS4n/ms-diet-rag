import type { Session } from "@/auth";


declare module "fastify" {
  interface FastifyRequest {
    session: Session;
  }
}