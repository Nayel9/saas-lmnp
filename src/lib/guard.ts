import { getUserRole } from "./auth";

export type GuardOutcome = "loading" | "unauthenticated" | "forbidden" | "ok";

/**
 * Détermine l'accès en fonction du rôle requis et de l'état user.
 * - requiredRole user => seulement vérifier authentification.
 * - requiredRole admin => nécessite authentification + rôle admin.
 */
export function evaluateAccess(
  requiredRole: "user" | "admin",
  user: { role?: string } | null | undefined,
  loading: boolean,
): GuardOutcome {
  if (loading) return "loading";
  if (!user) return "unauthenticated";
  if (requiredRole === "admin" && getUserRole(user) !== "admin")
    return "forbidden";
  return "ok";
}
