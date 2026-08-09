import { SignJWT, jwtVerify } from "jose";
import type { Env } from "../config/env.js";
import type { PortalRole } from "@prisma/client";

export type PartnerJwtPayload = {
  sub: string;
  email: string;
  companyId: string;
  role: PortalRole;
};

const PORTAL_ROLES: PortalRole[] = ["org_admin", "instructor", "viewer"];

function isPortalRole(value: unknown): value is PortalRole {
  return typeof value === "string" && (PORTAL_ROLES as string[]).includes(value);
}

export async function signPartnerJwt(env: Env, payload: PartnerJwtPayload): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new SignJWT({
    email: payload.email,
    companyId: payload.companyId,
    role: payload.role,
    kind: "partner",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(env.PARTNER_JWT_EXPIRES_IN)
    .sign(secret);
}

export async function verifyPartnerJwt(
  env: Env,
  token: string
): Promise<PartnerJwtPayload | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    // `kind` empêche un JWT admin d'ouvrir le portail (même secret HS256).
    if (payload.kind !== "partner") return null;
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    const companyId = typeof payload.companyId === "string" ? payload.companyId : null;
    if (!sub || !email || !companyId || !isPortalRole(payload.role)) return null;
    return { sub, email, companyId, role: payload.role };
  } catch {
    return null;
  }
}
