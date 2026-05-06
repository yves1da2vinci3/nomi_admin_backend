import { SignJWT, jwtVerify } from "jose";
import type { Env } from "../config/env.js";

export async function signAdminJwt(
  env: Env,
  payload: { sub: string; email: string }
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(secret);
}

export async function verifyAdminJwt(
  env: Env,
  token: string
): Promise<{ sub: string; email: string } | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!sub || !email) return null;
    return { sub, email };
  } catch {
    return null;
  }
}
