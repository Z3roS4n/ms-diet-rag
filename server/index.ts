import Fastify from "fastify";
import autoload from "@fastify/autoload";
import path from "path";
import "dotenv/config";

export const SERVER_PORT = 6969;

const fastify = Fastify({
  logger: true,
});
async function buildServer() {
  await fastify.register(autoload, {
    dir: path.join(import.meta.dirname, "plugins"),
    dirNameRoutePrefix: false,
  });

  await fastify.register(autoload, {
    dir: path.join(import.meta.dirname, "decorators"),
    dirNameRoutePrefix: false,
  });

  await fastify.register(autoload, {
    dir: path.join(import.meta.dirname, "routes"),
    autoHooks: true,
    autoHooksPattern: /\.hook(?:\.ts|\|\.cjs|\.mjs)$/i,
    cascadeHooks: true,
  });

  fastify.setNotFoundHandler((request, reply) => {
    request.log.warn(
      {
        request: {
          method: request.method,
          url: request.url,
          query: request.query,
          params: request.params,
        },
      },
      "Resource not found"
    );

    reply.code(404);

    return { message: "Not Found" };
  });

  fastify.ready().then(() => {
    console.log(fastify.printPlugins());
    console.log(fastify.printRoutes());
  });

  return fastify;
}

async function start() {
  try {
    await buildServer();
    await fastify.listen({ port: SERVER_PORT, host: "localhost" });
    console.log("DB_URL:", process.env.DATABASE_URL);

    const address = fastify.server.address();
    const port =
      typeof address === "object" && address ? address.port : SERVER_PORT;
    console.log(`🚀 fastify running on http://localhost:${port}`);
  } catch (err) {
    console.log(err);
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
