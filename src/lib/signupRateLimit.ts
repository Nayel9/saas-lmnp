export const SIGNUP_WINDOW_MS = 30_000;

// mémoire process (OK pour dev / petit déploiement single instance)
const _signupRL = new Map<string, number>();

// Ajout d'un type explicite pour la fonction
export function getSignupRateLimiter(): Map<string, number> {
  return _signupRL;
}
