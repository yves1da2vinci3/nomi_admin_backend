import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../config/env.js";

/** Returns null if ANTHROPIC_API_KEY is missing or too short — Studio AI routes must guard with 503. */
export function getAnthropicClient(env: Env): Anthropic | null {
  const key = env.ANTHROPIC_API_KEY;
  if (!key || key.length < 10) return null;
  return new Anthropic({ apiKey: key });
}

export function studioModelFromEnv(env: Env): string {
  return env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
}
