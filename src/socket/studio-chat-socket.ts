import type { Server as HTTPServer } from "node:http";
import { Server as IOServer } from "socket.io";
import type { Env } from "../config/env.js";
import { verifyAdminJwt } from "../lib/admin-jwt.js";
import { getAnthropicClient } from "../lib/anthropic.js";
import {
  brainstormBodySchema,
  chatBodySchema,
  designBodySchema,
  reviewBodySchema,
} from "../modules/studio/ai/schemas.js";
import {
  configureStudioAiEnv,
  generateBrainstormIdeas,
  generateChatReply,
  generateDesign,
  generateReview,
} from "../modules/studio/ai/service.js";

function extractBearer(socket: import("socket.io").Socket): string | null {
  const authTok = socket.handshake.auth;
  if (authTok && typeof authTok === "object" && typeof authTok.token === "string") {
    const t = authTok.token.trim();
    if (t) return t;
  }
  const h = socket.handshake.headers.authorization;
  if (typeof h === "string" && h.startsWith("Bearer ")) return h.slice(7).trim();
  return null;
}

export function attachStudioChatSocket(httpServer: HTTPServer, env: Env): IOServer {
  const io = new IOServer(httpServer, {
    cors: {
      origin: env.ADMIN_CORS_ORIGIN ?? true,
      credentials: true,
    },
    maxHttpBufferSize: 15 * 1024 * 1024,
  });

  io.use(async (socket, next) => {
    const bearer = extractBearer(socket);
    if (!bearer) {
      next(new Error("Unauthorized"));
      return;
    }
    if (bearer === env.ADMIN_API_TOKEN) {
      next();
      return;
    }
    const jwt = await verifyAdminJwt(env, bearer);
    if (!jwt) {
      next(new Error("Unauthorized"));
      return;
    }
    next();
  });

  io.on("connection", (socket) => {
    socket.on(
      "studio:chat",
      async (payload: unknown, cb: (err: unknown, result?: unknown) => void) => {
        if (typeof cb !== "function") return;
        configureStudioAiEnv(env);
        if (!getAnthropicClient(env)) {
          cb("AI unavailable: set ANTHROPIC_API_KEY");
          return;
        }
        try {
          const body = chatBodySchema.parse(payload);
          const data = await generateChatReply(body);
          cb(null, data);
        } catch (e) {
          cb(e instanceof Error ? e.message : String(e));
        }
      }
    );

    socket.on(
      "studio:brainstorm",
      async (payload: unknown, cb: (err: unknown, result?: unknown) => void) => {
        if (typeof cb !== "function") return;
        configureStudioAiEnv(env);
        if (!getAnthropicClient(env)) {
          cb("AI unavailable: set ANTHROPIC_API_KEY");
          return;
        }
        try {
          const body = brainstormBodySchema.parse(payload);
          const data = await generateBrainstormIdeas(body);
          cb(null, data);
        } catch (e) {
          cb(e instanceof Error ? e.message : String(e));
        }
      }
    );

    socket.on(
      "studio:design",
      async (payload: unknown, cb: (err: unknown, result?: unknown) => void) => {
        if (typeof cb !== "function") return;
        configureStudioAiEnv(env);
        if (!getAnthropicClient(env)) {
          cb("AI unavailable: set ANTHROPIC_API_KEY");
          return;
        }
        try {
          const body = designBodySchema.parse(payload);
          const data = await generateDesign(body);
          cb(null, data);
        } catch (e) {
          cb(e instanceof Error ? e.message : String(e));
        }
      }
    );

    socket.on(
      "studio:review",
      async (payload: unknown, cb: (err: unknown, result?: unknown) => void) => {
        if (typeof cb !== "function") return;
        configureStudioAiEnv(env);
        if (!getAnthropicClient(env)) {
          cb("AI unavailable: set ANTHROPIC_API_KEY");
          return;
        }
        try {
          const body = reviewBodySchema.parse(payload);
          const data = await generateReview(body);
          cb(null, data);
        } catch (e) {
          cb(e instanceof Error ? e.message : String(e));
        }
      }
    );
  });

  return io;
}
