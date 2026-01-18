import type { UserMemory } from "@/generated/prisma/client";
import { sessionMiddleware } from "@/middleware/session";
import { ragHandler } from "@/utils/rag/handler";
import { constructResponse } from "@/utils/response";
import type { FastifyInstance } from "fastify";

export default async function memoryRoutes(fastify: FastifyInstance) {

  interface MemoriesResponse {
    memories: UserMemory[];
    page: number;
    totalPages: number;
    totalMemories: number;
  }
  fastify.get("/memories", { preHandler: sessionMiddleware } , async (request, reply) => {
    const { query, limit, page } = request.query as { query?: string; limit?: number; page?: number };

    const take = limit ?? 10;
    const skip = ((page ?? 1) - 1) * take;
    
    if(query) {
      // Logic for searching memories based on query
      const memory = await ragHandler.getMemoryItems(request.session?.user.id, {});
      return reply.send(constructResponse<MemoriesResponse>({
        data: {
          memories: memory.filter(
            m => m.content.includes(query)
          ).slice(skip, skip + take),
          page: page ?? 1,
          totalPages: Math.ceil(
            memory.filter(
              m => m.content.includes(query)
            ).length / take
          ),
          totalMemories: memory.filter(
            m => m.content.includes(query)
          ).length
        }
      }));
    }

    const memories = await ragHandler.getMemoryItems(request.session?.user.id, { take, skip });
    const totalMemories = await ragHandler.countMemoryItems(request.session?.user.id);
    const totalPages = Math.ceil(totalMemories / take);

    return reply.send(constructResponse<MemoriesResponse>({
      data: {
        memories,
        page: page ?? 1,
        totalPages,
        totalMemories
      }
    }));
  });
}