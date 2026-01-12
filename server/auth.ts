import { betterAuth, getEnvVar } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/utils/prisma";
import { Role } from "@/generated/prisma/client";
import { SERVER_PORT } from ".";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: [
    "http://localhost:" + SERVER_PORT
  ],
  emailAndPassword: { enabled: true },
  baseURL: "http://localhost:" + SERVER_PORT,
  secret: getEnvVar("BETTER_AUTH_SECRET"),
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: Role.SUPPORTER,
        input: false,
      },
    },
  },
});

export type User = typeof auth.$Infer.Session.user;
export type Session = typeof auth.$Infer.Session;
