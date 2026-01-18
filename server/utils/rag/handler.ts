import { sql } from './../../generated/prisma/internal/prismaNamespace';
import { AI, openaiHandler, type ChatOptions, ChatRole } from "../openai/handler";
import { prisma } from "../prisma"
import { MessageRole, Prisma, type Message, type UserMemory } from '@/generated/prisma/client';

export const instructions = {
  chat: `You are a helpful AI assistant designed to aid users in managing their diet and nutrition.
    Your primary goal is to provide accurate, evidence-based information and support to help users make informed decisions about their dietary habits.
    You should be able to answer questions related to nutrition, meal planning, dietary restrictions, and healthy eating habits. Always prioritize the user's well-being and provide information that is aligned with current nutritional guidelines.
    If you are unsure about an answer, it is better to admit it rather than provide potentially misleading information. Remember to be empathetic and encouraging, as dietary changes can be challenging for many individuals.
    Your responses should be clear, concise, and tailored to the user's specific needs and preferences.
    Always ensure that your advice is practical and actionable, helping users to implement healthy dietary changes in their daily lives.`,
}

export enum MealTypes {
  BREAKFAST = "breakfast",
  LUNCH = "lunch",
  DINNER = "dinner",
  SNACK = "snack",
}

export interface DietPlanMeal {
  mealType: MealTypes;
  menu: string;
  calories: number;
  additionalInfo?: {
    portionSize?: string;
    nutritionalInfo?: {
      protein?: string;
      carbohydrates?: string;
      fats?: string;
    };
    workoutSuggestion?: string;
  };
}

export interface DietPlanDay {
  day: number;
  meals: DietPlanMeal[];
}

export interface DietPlan {
  dietPlan: DietPlanDay[];
}

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

  async getMemoryItems(userId: string, { take, skip }: { take?: number; skip?: number }): Promise<UserMemory[]> {
    const memories = await this.prisma.userMemory.findMany({
      where: { userId },
      take,
      skip,
    });
    return memories;
  }

  async countMemoryItems(userId: string): Promise<number> {
    const count = await this.prisma.userMemory.count({
      where: { userId },
    });
    return count;
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

  async getLastMessages(userId: string, limit: number = 10): Promise<Message[]> {
    const messages = await this.prisma.message.findMany({
      where: { chat: { userId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
  }

  async chatResponse(
    userId: string, 
    messages: { role: ChatRole; content: string; }[], 
    opts: ChatOptions = {}
  ) {
    const options = { 
      ...opts,
      temperature: 0.7, 
      max_tokens: 10000,
    };

    // SYSTEM INSTRUCTIONS
    messages.unshift({ role: ChatRole.SYSTEM, content: instructions.chat });

    // USER SAVED MEMORY
    const userMemory = await this.retrieveMemory(userId, messages[messages.length - 1]?.content ?? "", { k: 5 });
    const memoryContents = userMemory.join('\n');
    messages.unshift({ role: ChatRole.SYSTEM, content: `User Memory:\n${memoryContents}` });

    // RETRIEVED CONTEXT ( RAG PREDEFINED DOCUMENTS)
    const context = await this.retrieveContext(messages[messages.length - 1]?.content ?? "", { k: 5 });
    const contextContent = context.join('\n');
    messages.unshift({ role: ChatRole.SYSTEM, content: `Relevant Context:\n${contextContent}` });

    // LAST 5 MESSAGES FOR CONTEXT
    const previousMessages = await this.getLastMessages(userId, 5);
    previousMessages.forEach(msg => {
      messages.unshift({ role: msg.role as ChatRole, content: msg.content });
    });

    return await this.chatCompletion(messages, options);
  }

  async createDietPlan(
    userId: string, 
    preferences: string, 
    restrictions: string, 
    settings: { 
      caloriesPerDay: number, 
      mealsPerDay: number, 
      dietType: string, 
      durationInDays: number 
    }) {
    const userMemory = await this.retrieveMemory(userId, preferences + ' ' + restrictions, { k: 5 });
    const memoryContents = userMemory.join('\n');

    const context = await this.retrieveContext(preferences + ' ' + restrictions, { k: 5 });
    const contextContent = context.join('\n');

    const prompt = `Using the following user memory and context, create a personalized diet plan.
    
      User Memory:
      ${memoryContents}
      Relevant Context:
      ${contextContent}
      User Preferences:
      ${preferences}
      Dietary Restrictions:
      ${restrictions}

      Diet Plan Settings:
      - Calories Per Day: ${settings.caloriesPerDay}
      - Meals Per Day: ${settings.mealsPerDay}
      - Diet Type: ${settings.dietType}
      - Duration: ${settings.durationInDays} days

      Provide a detailed diet plan that aligns with the user's preferences and restrictions.
      
      Format the diet plan in a clear and organized manner, breaking it down by day and meal.
      Include portion sizes and nutritional information where applicable.
      Ensure the diet plan is practical and easy to follow.
      
      MANDATORY Response format MUST be in JSON as follows:
      Avoid any additional text outside the JSON structure.
      Approved Meal Types are: ${Object.values(MealTypes).join(', ')}

      {
        "dietPlan": [
          {
            "day": 1,
            "meals": [
              {
                "mealType": "breakfast",
                "menu": "Oatmeal with fresh berries and a side of Greek yogurt",
                "calories": 350,
                "additionalInfo": {
                  "portionSize": "1 bowl",
                  "nutritionalInfo": {
                    "protein": "15g",
                    "carbohydrates": "45g",
                    "fats": "8g"
                  },
                  "workoutSuggestion": "15 minutes of light stretching in the morning"
                }
              },
              {                
                "mealType": "lunch",
                "menu": "Grilled chicken salad with mixed greens, cherry tomatoes, and vinaigrette dressing",
                "calories": 450,
                "additionalInfo": {
                  "portionSize": "1 plate",
                  "nutritionalInfo": {
                    "protein": "35g",
                    "carbohydrates": "20g",
                    "fats": "15g"
                  },
                  "workoutSuggestion": "30 minutes of moderate cardio post-meal"
                }
              },
              {
                "mealType": "dinner",
                "menu": "Baked salmon with quinoa and steamed broccoli",
                "calories": 600,
                "additionalInfo": {
                  "portionSize": "1 plate",
                  "nutritionalInfo": {
                    "protein": "40g",
                    "carbohydrates": "50g",
                    "fats": "20g"
                  },
                  "workoutSuggestion": "20 minutes of yoga or meditation in the evening"
                }
              }
            ]
          },
          // Continue for the duration specified
        ]
      }`;

    const messages = [
      { role: ChatRole.USER, content: prompt }
    ];

    const response = await this.chatResponse(userId, messages, { temperature: 0.7, max_tokens: 10000 });

    try {
      const dietPlanJson: DietPlan = JSON.parse(response?.choices[0]?.message?.content ?? "");
      return dietPlanJson;
    } catch (error) {
      throw new Error("Failed to parse diet plan JSON response");
    }
  }
}

export const ragHandler = new RAG();