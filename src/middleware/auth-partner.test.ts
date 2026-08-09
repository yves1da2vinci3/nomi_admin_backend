import { describe, test, expect, mock } from "bun:test";
import {
  createPartnerAuthMiddleware,
  requireCompanyId,
  requirePortalRole,
} from "./auth-partner.js";
import { signPartnerJwt } from "../lib/partner-jwt.js";
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
  PARTNER_JWT_EXPIRES_IN: "12h",
  B2B_PORTAL_URL: "http://localhost:3000",
  USAGE_INGEST_INTERVAL_MS: 0,
  ANTHROPIC_API_KEY: "sk-ant-test-key-1234567890",
  ANTHROPIC_MODEL: "claude-haiku-4-5-20251001",
  NOMI_CORE_URL: "http://localhost:8088",
  B2_BUCKET_NAME: "nomiBucket",
};

const partnerClaims = {
  sub: "8c0f7f4e-1e5a-4a1e-9c11-2f1f0a11b222",
  email: "marie@binne.ci",
  companyId: "3f1b9a2c-5d6e-4f70-8a91-0b1c2d3e4f50",
  role: "org_admin" as const,
};

function makeReqRes(authHeader?: string) {
  const req = {
    headers: authHeader ? { authorization: authHeader } : {},
    partnerAuth: undefined as unknown,
  } as unknown as Request;

  const resMock = { statusCode: 200, body: null as unknown };
  const res = {
    status(code: number) {
      resMock.statusCode = code;
      return this;
    },
    json(body: unknown) {
      resMock.body = body;
      return this;
    },
  } as unknown as Response;

  const next = mock(() => {});

  return { req, res, resMock, next };
}

describe("createPartnerAuthMiddleware", () => {
  test("missing Authorization header → 401", async () => {
    const mw = createPartnerAuthMiddleware(testEnv);
    const { req, res, resMock, next } = makeReqRes();
    await mw(req, res, next);
    expect(resMock.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("valid partner JWT → next, partnerAuth renseigné", async () => {
    const mw = createPartnerAuthMiddleware(testEnv);
    const token = await signPartnerJwt(testEnv, partnerClaims);
    const { req, res, next } = makeReqRes(`Bearer ${token}`);
    await mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.partnerAuth?.companyId).toBe(partnerClaims.companyId);
    expect(req.partnerAuth?.role).toBe("org_admin");
  });

  test("ADMIN_API_TOKEN refusé sur le portail → 401", async () => {
    const mw = createPartnerAuthMiddleware(testEnv);
    const { req, res, resMock, next } = makeReqRes(`Bearer ${testEnv.ADMIN_API_TOKEN}`);
    await mw(req, res, next);
    expect(resMock.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("JWT admin refusé faute de claims portail → 401", async () => {
    const mw = createPartnerAuthMiddleware(testEnv);
    const token = await signAdminJwt(testEnv, { sub: partnerClaims.sub, email: "a@b.c" });
    const { req, res, resMock, next } = makeReqRes(`Bearer ${token}`);
    await mw(req, res, next);
    expect(resMock.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("JWT expiré → 401", async () => {
    const mw = createPartnerAuthMiddleware(testEnv);
    const token = await signPartnerJwt({ ...testEnv, PARTNER_JWT_EXPIRES_IN: "0s" }, partnerClaims);
    await new Promise((r) => setTimeout(r, 100));
    const { req, res, resMock, next } = makeReqRes(`Bearer ${token}`);
    await mw(req, res, next);
    expect(resMock.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requirePortalRole", () => {
  test("rôle autorisé → next", () => {
    const { req, res, next } = makeReqRes();
    req.partnerAuth = partnerClaims;
    requirePortalRole("org_admin")(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("rôle insuffisant → 403", () => {
    const { req, res, resMock, next } = makeReqRes();
    req.partnerAuth = { ...partnerClaims, role: "viewer" };
    requirePortalRole("org_admin", "instructor")(req, res, next);
    expect(resMock.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("sans partnerAuth → 401", () => {
    const { req, res, resMock, next } = makeReqRes();
    requirePortalRole("org_admin")(req, res, next);
    expect(resMock.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireCompanyId", () => {
  test("renvoie le companyId du token", () => {
    expect(requireCompanyId({ partnerAuth: partnerClaims })).toBe(partnerClaims.companyId);
  });

  test("lève si la route n'est pas protégée", () => {
    expect(() => requireCompanyId({})).toThrow(/not protected/);
  });
});
