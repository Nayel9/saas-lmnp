import crypto from 'crypto';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export interface SendVerificationEmailParams {
  email: string;
  verifyUrl: string;
}

export async function sendVerificationEmail({ email, verifyUrl }: SendVerificationEmailParams): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || 'LMNP App';
  const debug = process.env.BREVO_DEBUG === '1';
  if (!apiKey || !fromEmail) {
    console.warn('[brevo][skip] Missing BREVO_API_KEY or EMAIL_FROM. Logging link only.');
    console.log('[verify-url]', verifyUrl);
    return;
  }
  const payload = {
    sender: { email: fromEmail, name: fromName },
    to: [{ email }],
    subject: 'Vérifiez votre email',
    htmlContent: `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#222;line-height:1.5">\n    <h1 style=\"font-size:16px;margin:0 0 12px\">Bienvenue !</h1>\n    <p style=\"margin:0 0 12px\">Merci de votre inscription. Veuillez confirmer votre adresse email pour activer votre compte.</p>\n    <p style=\"margin:0 0 16px\"><a href=\"${verifyUrl}\" style=\"display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:4px;font-weight:600\">Activer mon compte</a></p>\n    <p style=\"margin:0 0 12px\">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur:<br><span style=\"word-break:break-all\">${verifyUrl}</span></p>\n    <p style=\"margin:24px 0 0;font-size:12px;color:#666\">Ce lien expire dans 24h.</p>\n  </div>`,
    tags: ['email_verification'],
  };
  if (debug) {
    console.debug('[brevo][debug][request]', JSON.stringify({ ...payload, htmlContent: '[omitted]' }, null, 2));
  }
  try {
    const resp = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      let body: unknown;
      try { body = await resp.json(); } catch { body = await resp.text(); }
      console.error('[brevo][error]', resp.status, body);
      if (debug) console.debug('[brevo][debug][verify-url]', verifyUrl);
      throw new Error('BREVO_SEND_FAILED');
    } else if (debug) {
      let body: unknown = null; try { body = await resp.json(); } catch {/* ignore */}
      console.debug('[brevo][debug][success]', body || '(empty response)');
    }
  } catch (e) {
    console.error('[brevo][exception]', e);
    if (debug) console.debug('[brevo][debug][link]', verifyUrl);
  }
}

export function generateVerificationToken(): { token: string; hash: string; expires: Date } {
  const buf = crypto.randomBytes(32);
  const token = buf.toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { token, hash, expires };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
