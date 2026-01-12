import fp from "fastify-plugin";
import cors from "@fastify/cors";
import { SERVER_PORT } from "..";

const corsPlugin = fp(async (fastify) => {
  fastify.register(cors, {
    origin: process.env.CLIENT_ORIGIN || "http://localhost:" + SERVER_PORT,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    maxAge: 86400,
  });
});

export default corsPlugin;
