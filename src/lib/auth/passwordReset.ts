import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Durée de validité: 30 min
export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

// Validation input
export const forgotPasswordSchema = z.object({
  email: z.string().email().transform((e) => e.trim().toLowerCase()),
});
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token requis").optional(),
  password: z.string().min(8, "Mot de passe trop court (min 8)"),
});

// Stockage des tokens en clair (dev/test uniquement)
const plainResetTokens = new Map<string, string>(); // key = userId
export function storePlainPasswordResetToken(userId: string, token: string) {
  if (process.env.NODE_ENV === "production") return;
  plainResetTokens.set(userId, token);
}
export function getPlainPasswordResetToken(userId: string) {
  return plainResetTokens.get(userId);
}
export function clearPlainPasswordResetToken(userId: string) {
  plainResetTokens.delete(userId);
}

export interface GeneratedPasswordResetToken {
  token: string; // en clair
  hash: string;  // hash bcrypt
  expiresAt: Date;
}

export function generatePasswordResetToken(): GeneratedPasswordResetToken {
  const buf = crypto.randomBytes(32);
  const token = buf.toString("base64url");
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(token, salt);
  return { token, hash, expiresAt };
}

// Recherche un token valide (non expiré) correspondant au plainToken fourni
export async function findValidPasswordResetToken(plainToken: string) {
  const now = new Date();
  const candidates = await prisma.passwordResetToken.findMany({
    where: { expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    take: 200, // limite de sécurité
  });
  for (const t of candidates) {
    const ok = await bcrypt.compare(plainToken, t.token);
    if (ok) return t;
  }
  return null;
}

export async function consumePasswordResetToken(plainToken: string) {
  const rec = await findValidPasswordResetToken(plainToken);
  if (!rec) return null;
  return rec; // la suppression globale est faite après reset du mdp
}
