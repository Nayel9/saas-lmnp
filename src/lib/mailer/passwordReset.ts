const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export interface SendPasswordResetEmailParams {
  email: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail({ email, resetUrl }: SendPasswordResetEmailParams) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || "LMNP App";
  const debug = process.env.BREVO_DEBUG === "1";
  const subject = "Réinitialisation de mot de passe";
  const text = `Cliquez sur ce lien pour réinitialiser votre mot de passe : ${resetUrl} (valide 30 min)`;
  const html = `<p>Bonjour,</p><p>Cliquez sur ce lien pour réinitialiser votre mot de passe (valide 30 min):</p><p><a href='${resetUrl}'>Réinitialiser mon mot de passe</a></p><p style='font-size:12px;color:#555;word-break:break-all'>${resetUrl}</p>`;
  if (!apiKey || !fromEmail) {
    console.warn("[password-reset-email][skip] Missing BREVO_API_KEY or EMAIL_FROM. Logging link seulement.");
    console.log("[password-reset-link]", resetUrl);
    return;
  }
  const payload = {
    sender: { email: fromEmail, name: fromName },
    to: [{ email }],
    subject,
    htmlContent: html,
    textContent: text,
    tags: ["password_reset"],
  };
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
      try { body = await resp.json(); } catch { body = await resp.text(); }
      console.error("[password-reset-email][error]", resp.status, body);
      if (debug) console.debug("[password-reset-link]", resetUrl);
    }
  } catch (e) {
    console.error("[password-reset-email][exception]", e);
    if (debug) console.debug("[password-reset-link]", resetUrl);
  }
}
