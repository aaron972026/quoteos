import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "qos_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const ALG = "HS256";

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a string of at least 32 characters. See .env.example."
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sid: string; // session UUID
  iat?: number;
}

export async function mintSessionJwt(sessionId: string): Promise<string> {
  return await new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifySessionJwt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (typeof payload.sid !== "string") return null;
    return { sid: payload.sid, iat: payload.iat };
  } catch {
    return null;
  }
}

/** Read session cookie from incoming request (App Router server context). */
export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const c = cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionJwt(token);
}

/** Set session cookie in App Router response context. */
export async function setSessionCookie(sessionId: string): Promise<string> {
  const token = await mintSessionJwt(sessionId);
  const c = cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return token;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
