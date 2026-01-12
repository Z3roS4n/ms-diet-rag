import type { BetterAuthOptions } from "better-auth";
import { auth } from "@/auth";

import FastifyBetterAuth, {
  type FastifyBetterAuthOptions,
} from "fastify-better-auth";

export const autoConfig: FastifyBetterAuthOptions<BetterAuthOptions> = {
  auth,
};

export default FastifyBetterAuth;
