import type { Server as HTTPServer } from "node:http";
import { Server as IOServer } from "socket.io";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { verifyAdminJwt } from "../lib/admin-jwt.js";
import { getAnthropicClient } from "../lib/anthropic.js";
import { getRedisClient, BRAINSTORM_KEY, BRAINSTORM_TTL } from "../lib/redis.js";
import { prisma } from "../lib/prisma.js";
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
import { updateProject } from "../modules/studio/projects/service.js";

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

const brainstormSaveSchema = z.object({
  projectId: z.string().min(1),
  ideas: z.array(z.unknown()),
  activeIdeaId: z.string().nullable(),
});

const brainstormFlushSchema = z.object({
  projectId: z.string().min(1),
});

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
      socket.data.adminId = env.ADMIN_API_ACTING_SUB ?? null;
      next();
      return;
    }
    const jwt = await verifyAdminJwt(env, bearer);
    if (!jwt) {
      next(new Error("Unauthorized"));
      return;
    }
    socket.data.adminId = jwt.sub;
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

    socket.on(
      "studio:brainstorm:save",
      async (payload: unknown, cb: (err: unknown, result?: unknown) => void) => {
        if (typeof cb !== "function") return;
        try {
          const { projectId, ideas, activeIdeaId } = brainstormSaveSchema.parse(payload);
          const redis = getRedisClient();
          if (redis) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await redis.json.set(BRAINSTORM_KEY(projectId), "$", { ideas, activeIdeaId, savedAt: new Date().toISOString() } as any);
            await redis.expire(BRAINSTORM_KEY(projectId), BRAINSTORM_TTL);
          }
          cb(null, { ok: true });
        } catch (e) {
          cb(e instanceof Error ? e.message : String(e));
        }
      }
    );

    socket.on(
      "studio:brainstorm:flush",
      async (payload: unknown, cb: (err: unknown, result?: unknown) => void) => {
        if (typeof cb !== "function") return;
        try {
          const { projectId } = brainstormFlushSchema.parse(payload);
          const redis = getRedisClient();
          if (!redis) { cb(null, { ok: true, persisted: false }); return; }

          const stored = await redis.json.get(BRAINSTORM_KEY(projectId)) as {
            ideas: unknown[];
            activeIdeaId: string | null;
          } | null;
          if (!stored) { cb(null, { ok: true, persisted: false }); return; }

          const project = await prisma.studioProject.findUnique({ where: { id: projectId } });
          if (!project) { cb("Project not found"); return; }

          const merged = {
            ...(project.state as Record<string, unknown>),
            ideas: stored.ideas,
            activeIdeaId: stored.activeIdeaId,
          };
          await updateProject(project.adminId, projectId, { state: merged });
          await redis.del(BRAINSTORM_KEY(projectId));

          cb(null, { ok: true, persisted: true });
        } catch (e) {
          cb(e instanceof Error ? e.message : String(e));
        }
      }
    );
  });

  return io;
}
