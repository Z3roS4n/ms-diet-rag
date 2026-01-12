export default async function pingRoutes(fastify: any) {
  fastify.get("/ping", async (request: any, reply: any) => {
    return { message: "pong" };
  });
}