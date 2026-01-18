import type { FastifyInstance } from "fastify";

export default async function dietPlanRoutes(fastify: FastifyInstance) {
  fastify.post("/diet-plan", async (request, reply) => {
    return { dietPlan: "This is a sample diet plan." };
  });
}