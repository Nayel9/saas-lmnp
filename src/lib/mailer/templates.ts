// Génération des templates d'emails

export interface VerificationEmailRenderParams {
  brand: string;
  logoUrl: string | null;
  verifyUrl: string;
  greetingLine: string;
}

export interface VerificationEmailRendered {
  subject: string;
  html: string;
  text: string;
}

export function renderVerificationEmail(params: VerificationEmailRenderParams): VerificationEmailRendered {
  const { brand, logoUrl, verifyUrl, greetingLine } = params;
  const year = new Date().getFullYear();
  const subject = 'Vérifiez votre email';
  const text = `${greetingLine}\n\nBienvenue sur ${brand}. Cliquez sur le lien ci-dessous pour activer votre compte (valide 24h).\n${verifyUrl}\n\nSi vous n'êtes pas à l'origine de cette inscription, ignorez ce message.`;
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;color:#222;line-height:1.5"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:32px"><tr><td style="text-align:center;padding-bottom:12px">${logoUrl ? `<img src='${logoUrl}' alt='Logo ${brand}' width='160' style='display:block;margin:0 auto 10px;max-width:160px;height:auto' />` : ''}<h1 style="margin:0;font-size:20px;font-weight:600;color:#111">${brand}</h1><p style="margin:4px 0 0;font-size:12px;color:#555">Confirmation d'email</p></td></tr><tr><td style="padding-top:8px"><p style="margin:0 0 12px">${greetingLine}</p><p style="margin:0 0 16px">Merci de votre inscription. Pour activer votre compte, cliquez sur le bouton ci‑dessous (valide 24h).</p><p style="margin:0 0 24px;text-align:center"><a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;font-size:14px">Activer mon compte</a></p><p style="margin:0 0 16px;font-size:12px;color:#555">Si le bouton ne fonctionne pas, copiez ce lien :<br><span style="word-break:break-all;color:#2563eb">${verifyUrl}</span></p><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" /><p style="margin:0;font-size:11px;color:#777">Si vous n'êtes pas à l'origine de cette action, ignorez cet email. © ${year} ${brand}</p></td></tr></table></td></tr></table>`;
  return { subject, html, text };
}

