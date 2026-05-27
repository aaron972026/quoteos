import { SignJWT, jwtVerify } from "jose";

/**
 * Magic-link tokens — let an abandoning user click an SMS/email link to
 * resume their quote without re-authenticating. The token carries the
 * session id and the quote id, signed with the same SESSION_SECRET.
 *
 * Distinct from regular session JWTs via the `m: 1` claim — the magic-link
 * verifier rejects a stolen session cookie value masquerading as a link,
 * and vice versa.
 */

const ALG = "HS256";
const EXPIRY = "7d"; // matches quote validity window

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be 32+ chars. See .env.example.");
  }
  return new TextEncoder().encode(secret);
}

export interface MagicLinkPayload {
  sid: string;
  qid: string;
}

export async function mintMagicLinkToken(
  sessionId: string,
  quoteId: string
): Promise<string> {
  return await new SignJWT({ sid: sessionId, qid: quoteId, m: 1 })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

export async function verifyMagicLinkToken(
  token: string
): Promise<MagicLinkPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
    });
    if (
      payload.m !== 1 ||
      typeof payload.sid !== "string" ||
      typeof payload.qid !== "string"
    ) {
      return null;
    }
    return { sid: payload.sid, qid: payload.qid };
  } catch {
    return null;
  }
}

/** Build the full URL a customer clicks. */
export function buildMagicLinkUrl(
  origin: string,
  token: string,
  resumeAt: "draw" | "configure" | "quote" = "draw"
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/api/v1/sessions/magic-link?t=${encodeURIComponent(token)}&r=${resumeAt}`;
}
