/**
 * Thin Twilio SMS wrapper — direct REST API, no twilio-sdk dep. Same pattern
 * as our Supabase Storage helper.
 *
 * Setup:
 *  1. Get an Account SID + Auth Token from twilio.com Console → Account.
 *  2. Buy or use a Twilio phone number (must be SMS-capable).
 *  3. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in env.
 *
 * Returns ok:true with the message SID on success; ok:false with a code when
 * unconfigured or the upstream errored. Never throws — callers should fall
 * through gracefully (SMS is a recovery channel, not the primary path).
 */

export interface SmsResult {
  ok: true;
  messageSid: string;
}

export interface SmsError {
  ok: false;
  code: "TWILIO_NOT_CONFIGURED" | "TWILIO_UPSTREAM" | "TWILIO_BAD_RESPONSE";
  message: string;
  status?: number;
}

const PLACEHOLDERS = new Set(["", "AC_xxx", "your-twilio-sid"]);

interface Config {
  ok: true;
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

function getConfig(): Config | SmsError {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (
    !accountSid ||
    !authToken ||
    !fromNumber ||
    PLACEHOLDERS.has(accountSid) ||
    PLACEHOLDERS.has(authToken)
  ) {
    return {
      ok: false,
      code: "TWILIO_NOT_CONFIGURED",
      message:
        "Twilio not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in .env.local.",
    };
  }
  return { ok: true, accountSid, authToken, fromNumber };
}

export async function sendSms(
  to: string,
  body: string
): Promise<SmsResult | SmsError> {
  const cfg = getConfig();
  if (cfg.ok === false) return cfg;

  // Twilio expects E.164 ("+15551234567"). Normalize a bare US 10-digit number.
  const normalizedTo = to.startsWith("+")
    ? to
    : `+1${to.replace(/\D/g, "")}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`;
  const form = new URLSearchParams({
    To: normalizedTo,
    From: cfg.fromNumber,
    Body: body,
  });

  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
  } catch (err) {
    return {
      ok: false,
      code: "TWILIO_UPSTREAM",
      message:
        err instanceof Error ? err.message : "Network error calling Twilio",
    };
  }

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return {
      ok: false,
      code: "TWILIO_UPSTREAM",
      message: `Twilio returned ${r.status}: ${text.slice(0, 240)}`,
      status: r.status,
    };
  }

  const json = (await r.json().catch(() => null)) as { sid?: string } | null;
  if (!json?.sid) {
    return {
      ok: false,
      code: "TWILIO_BAD_RESPONSE",
      message: "Twilio response missing message sid",
    };
  }
  return { ok: true, messageSid: json.sid };
}
