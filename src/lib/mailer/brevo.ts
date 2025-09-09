import crypto from "crypto";
import { renderVerificationEmail } from "./templates";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export interface SendVerificationEmailParams {
  email: string;
  verifyUrl: string;
  firstName?: string | null;
  lastName?: string | null;
}

export async function sendVerificationEmail({
  email,
  verifyUrl,
  firstName,
  lastName,
}: SendVerificationEmailParams): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || "LMNP App";
  const debug = process.env.BREVO_DEBUG === "1";
  if (!apiKey || !fromEmail) {
    console.warn(
      "[brevo][skip] Missing BREVO_API_KEY or EMAIL_FROM. Logging link only.",
    );
    console.log("[verify-url]", verifyUrl);
    return;
  }
  const brand = fromName;
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  const logoFromEnv = process.env.EMAIL_LOGO_URL;
  const logoUrl =
    logoFromEnv ||
    (site ? site.replace(/\/$/, "") + "/LMNPlus_logo_variant_2.png" : null);
  const greetingName = (firstName || lastName || "").trim();
  const greetingLine = greetingName ? `Bonjour ${greetingName},` : "Bonjour,";
  const { subject, html, text } = renderVerificationEmail({
    brand,
    logoUrl,
    verifyUrl,
    greetingLine,
  });
  const payload = {
    sender: { email: fromEmail, name: fromName },
    to: [{ email }],
    subject,
    htmlContent: html,
    textContent: text,
    tags: ["email_verification"],
  };
  if (debug) {
    console.debug(
      "[brevo][debug][request]",
      JSON.stringify({ ...payload, htmlContent: "[omitted]" }, null, 2),
    );
  }
  try {
    const resp = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      let body: unknown;
      try {
        body = await resp.json();
      } catch {
        body = await resp.text();
      }
      console.error("[brevo][error]", resp.status, body);
      if (debug) console.debug("[brevo][debug][verify-url]", verifyUrl);
      throw new Error("BREVO_SEND_FAILED");
    } else if (debug) {
      let body: unknown = null;
      try {
        body = await resp.json();
      } catch {
        /* ignore */
      }
      console.debug("[brevo][debug][success]", body || "(empty response)");
    }
  } catch (e) {
    console.error("[brevo][exception]", e);
    if (debug) console.debug("[brevo][debug][link]", verifyUrl);
  }
}

export function generateVerificationToken(): {
  token: string;
  hash: string;
  expires: Date;
} {
  const buf = crypto.randomBytes(32);
  const token = buf.toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { token, hash, expires };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
