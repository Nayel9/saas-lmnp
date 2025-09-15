// src/lib/auth/errors.ts
// Erreurs typées pour la sécurité / guards
export class UnauthorizedError extends Error {
  readonly status = 401 as const;
  constructor(message = "Utilisateur non authentifié") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403 as const;
  constructor(message = "Accès interdit") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function errorToResponse(err: unknown): Response | null {
  if (err instanceof UnauthorizedError) {
    return new Response(err.message, { status: err.status });
  }
  if (err instanceof ForbiddenError) {
    return new Response(err.message, { status: err.status });
  }
  return null;
}

