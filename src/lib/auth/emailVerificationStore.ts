// Stockage en mémoire des tokens en clair uniquement pour tests / dev (pas production)
const plainTokens = new Map<string, string>();

export function storePlainVerificationToken(identifier: string, token: string) {
  if (process.env.NODE_ENV === 'production') return;
  plainTokens.set(identifier.toLowerCase(), token);
}

export function getPlainVerificationToken(identifier: string): string | undefined {
  return plainTokens.get(identifier.toLowerCase());
}

export function clearPlainVerificationToken(identifier: string) {
  plainTokens.delete(identifier.toLowerCase());
}

