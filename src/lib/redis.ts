import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

let _client: RedisClient | null = null;

export function getRedisClient(): RedisClient | null {
  return _client;
}

export async function connectRedis(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) return;
  const c = createClient({ url });
  c.on("error", (e: Error) => console.error("[redis]", e.message));
  await c.connect();
  _client = c;
}

export const BRAINSTORM_KEY = (projectId: string) => `studio:brainstorm:${projectId}`;
export const BRAINSTORM_TTL = 86_400; // 24h
