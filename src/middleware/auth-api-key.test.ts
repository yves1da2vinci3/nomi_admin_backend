import { describe, test, expect, mock } from "bun:test";
import { createAuthApiKeyMiddleware } from "./auth-api-key.js";
import { signAdminJwt } from "../lib/admin-jwt.js";
import type { Env } from "../config/env.js";
import type { Request, Response } from "express";

const testEnv: Env = {
  NODE_ENV: "test",
  PORT: 4001,
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  ADMIN_API_TOKEN: "test-api-token-12345",
  JWT_SECRET: "test-jwt-secret-minimum-sixteen-chars",
  JWT_EXPIRES_IN: "8h",
  ANTHROPIC_API_KEY: "sk-ant-test-key-1234567890",
  ANTHROPIC_MODEL: "claude-haiku-4-5-20251001",
  B2_BUCKET_NAME: "nomiBucket",
};

function makeReqRes(authHeader?: string) {
  const req = {
    headers: authHeader ? { authorization: authHeader } : {},
    adminAuth: undefined as unknown,
  } as unknown as Request;

  const resMock = { statusCode: 200, body: null as unknown };
  const res = {
    status(code: number) { resMock.statusCode = code; return this; },
    json(body: unknown) { resMock.body = body; return this; },
  } as unknown as Response;

  const next = mock(() => {});

  return { req, res, resMock, next };
}

describe("createAuthApiKeyMiddleware", () => {
  test("missing Authorization header → 401", async () => {
    const mw = createAuthApiKeyMiddleware(testEnv);
    const { req, res, resMock, next } = makeReqRes();
    await mw(req, res, next);
    expect(resMock.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("valid ADMIN_API_TOKEN without ADMIN_API_ACTING_SUB → calls next, no adminAuth", async () => {
    const mw = createAuthApiKeyMiddleware(testEnv);
    const { req, res, next } = makeReqRes(`Bearer ${testEnv.ADMIN_API_TOKEN}`);
    await mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req as { adminAuth?: unknown }).adminAuth).toBeUndefined();
  });

  test("valid ADMIN_API_TOKEN with ADMIN_API_ACTING_SUB → sets adminAuth", async () => {
    const env = {
      ...testEnv,
      ADMIN_API_ACTING_SUB: "550e8400-e29b-41d4-a716-446655440000",
      ADMIN_API_ACTING_EMAIL: "bot@example.com",
    };
    const mw = createAuthApiKeyMiddleware(env);
    const { req, res, next } = makeReqRes(`Bearer ${env.ADMIN_API_TOKEN}`);
    await mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    const auth = (req as { adminAuth?: { sub: string; email: string } }).adminAuth;
    expect(auth?.sub).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(auth?.email).toBe("bot@example.com");
  });

  test("valid JWT → calls next, sets adminAuth", async () => {
    const mw = createAuthApiKeyMiddleware(testEnv);
    const token = await signAdminJwt(testEnv, { sub: "admin-123", email: "admin@test.com" });
    const { req, res, next } = makeReqRes(`Bearer ${token}`);
    await mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(((req as { adminAuth?: { sub: string } }).adminAuth)?.sub).toBe("admin-123");
  });

  test("invalid token (neither API key nor valid JWT) → 401", async () => {
    const mw = createAuthApiKeyMiddleware(testEnv);
    const { req, res, resMock, next } = makeReqRes("Bearer not-a-valid-token");
    await mw(req, res, next);
    expect(resMock.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("expired JWT → 401", async () => {
    const mw = createAuthApiKeyMiddleware(testEnv);
    const expiredEnv = { ...testEnv, JWT_EXPIRES_IN: "0s" };
    const token = await signAdminJwt(expiredEnv, { sub: "admin-456", email: "x@test.com" });
    await new Promise((r) => setTimeout(r, 100));
    const { req, res, resMock, next } = makeReqRes(`Bearer ${token}`);
    await mw(req, res, next);
    expect(resMock.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
