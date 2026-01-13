import OpenAI from "openai";
import type { ChatCompletionTool } from "openai/resources.js";
import type { ChatCompletionMessageParam, ChatCompletionCreateParams, ChatCompletionToolChoiceOption } from "openai/resources/chat/completions";

export enum ChatRole {
  SYSTEM = "system",
  USER = "user",
  ASSISTANT = "assistant",
}

export enum AIModel {
  GPT4oMini = "gpt-4o-mini",
  GPT4o = "gpt-4o",
  GPT35Turbo = "gpt-3.5-turbo",
  TextEmbedding3Small = "text-embedding-3-small",
}

export type AIRequestMessage = {
  role: ChatRole;
  content: string;
  name?: string;
};

export type ChatOptions = {
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
  n?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  tools?: ChatCompletionTool[];
  tool_choice?: ChatCompletionToolChoiceOption;
  user?: string;
  timeoutMs?: number;
  retries?: number;
};

const DEFAULT_CHAT_MODEL: AIModel = AIModel.GPT4oMini;
const DEFAULT_EMBEDDING_MODEL: AIModel = AIModel.TextEmbedding3Small;

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in environment variables");
}

export class AI {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }



  sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async withRetries<T>(fn: () => Promise<T>, retries = 2, baseDelay = 250): Promise<T> {
    let attempt = 0;
    for (;;) {
      try {
        return await fn();
      } catch (err) {
        attempt++;
        const retriable = this.isRetriableError(err);
        if (!retriable || attempt > retries) throw err;
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
  }

  private isRetriableError(err: unknown) {
    if (!err) return false;
    // attempt to read common fields safely
    const e = err as { status?: number; statusCode?: number; code?: string | number };
    const status = e.status ?? e.statusCode ?? e.code;
    // 429 or 5xx are normally retriable
    if (status === 429) return true;
    if (typeof status === "number" && status >= 500 && status < 600) return true;
    // network level or transient
    const transientMessages = ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"];
    if (typeof e.code === "string" && transientMessages.includes(e.code)) return true;
    return false;
  }

  async chatCompletion(messages: AIRequestMessage[], opts: ChatOptions) {
    const { timeoutMs, retries, ...apiOptions } = opts;
    const payload = {
      ...apiOptions,
      model: opts.model || DEFAULT_CHAT_MODEL,
      temperature: opts.temperature ?? 0.2,
      messages: messages as ChatCompletionMessageParam[],
    };

    const resp = await this.withRetries(
      async () => {
        return this.openai.chat.completions.create(payload);
      },
      retries
    );
    return resp;
  }

  async createEmbedding(input: string | string[]) {
    const resp = await this.withRetries(
      async () => {
        return this.openai.embeddings.create({
          model: DEFAULT_EMBEDDING_MODEL,
          input,
        });
      },
      2
    );
    return resp;
  }
}

export const openaiHandler = new AI();