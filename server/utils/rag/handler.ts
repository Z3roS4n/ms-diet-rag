import { sql } from './../../generated/prisma/internal/prismaNamespace';
import { AI, openaiHandler } from "../openai/handler";
import { prisma } from "../prisma"
import { Prisma, type UserMemory } from '@/generated/prisma/client';

class RAG extends AI {
  private prisma: typeof prisma;

  constructor() {
    super();
    this.prisma = prisma;
  }

  private toPgVector(embedding: number[]): string {
    return JSON.stringify(embedding);
  }

  async retrieveContext(query: string, opts: { k?: number }): Promise<string[]> {
    const queryEmbedding = await this.createEmbedding(query);
    if (!queryEmbedding.data[0]) {
      throw new Error("No embedding data returned");
    }
    const embeddingVector = queryEmbedding.data[0].embedding;
    const vector = this.toPgVector(embeddingVector);
    const results = await this.prisma.$queryRaw<{ content: string }[]>(
      Prisma.sql`
        SELECT id, content, 1 - (embedding <#> ${vector}::vector) AS score
        FROM chunk
        ORDER BY embedding <#> ${vector}::vector
        LIMIT ${opts.k || 5}
    `);

    return results.map((row: any) => row.content);
  }

  async retrieveMemory(userId: string, query: string, opts: { k?: number }): Promise<string[]> {
    const queryEmbedding = await this.createEmbedding(query);
    if (!queryEmbedding.data[0]) {
      throw new Error("No embedding data returned");
    }
    const embeddingVector = queryEmbedding.data[0].embedding;
    const vector = this.toPgVector(embeddingVector);
    const results = await this.prisma.$queryRaw<{ content: string }[]>(
      Prisma.sql`
        SELECT id, content, 1 - (embedding <#> ${vector}::vector) AS score
        FROM memory
        WHERE "userId" = ${userId}
        ORDER BY embedding <#> ${vector}::vector
        LIMIT ${opts.k || 5}
    `);

    return results.map((row: any) => row.content);
  }

  async getMemoryItems(userId: string): Promise<UserMemory[]> {
    const memories = await this.prisma.userMemory.findMany({
      where: { userId },
    });
    return memories;
  }

  async saveMemory(userId: string, content: string): Promise<UserMemory> {
    const embeddingResponse = await this.createEmbedding(content);
    if (!embeddingResponse.data[0]) {
      throw new Error("No embedding data returned");
    }
    const embeddingVector = embeddingResponse.data[0].embedding;
    const vector = this.toPgVector(embeddingVector);

    const newMemory = await this.prisma.$queryRaw<UserMemory>(
      Prisma.sql`
        INSERT INTO memory ("userId", content, embedding)
        VALUES (${userId}, ${content}, ${vector}::vector)
    `);

    return newMemory;
  }

  async purgeMemory(userId: string): Promise<void> {
    await this.prisma.userMemory.deleteMany({
      where: { userId },
    });
  }

  async deleteMemoryItem(memoryId: string): Promise<void> {
    await this.prisma.userMemory.delete({
      where: { id: memoryId },
    });
  }

  async chatResponse(messages: any[], opts: any = {}) {
    // Custom RAG logic can be added here, e.g., fetching documents from the database
    return await this.chatCompletion(messages, opts);
  }
}

export const ragHandler = new RAG();