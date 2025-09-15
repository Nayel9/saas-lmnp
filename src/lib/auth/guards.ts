// src/lib/auth/guards.ts
"use server";
import { z } from "zod";
import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/options";
import { ForbiddenError, UnauthorizedError } from "./errors";
import type { NextRequest } from "next/server";

export interface SessionResult {
  user: SessionUser;
}

/** Récupère la session et retourne l'user typé ou jette UnauthorizedError */
export async function requireSession(): Promise<SessionResult> {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user || !user.id) throw new UnauthorizedError();
  return { user };
}

const UUID = z.string().uuid();

// Helper interne: vérifie ownership en partant d'un userId déjà authentifié
async function verifyPropertyOwnership(userId: string, rawId: string): Promise<string> {
  const parsed = UUID.safeParse(rawId);
  if (!parsed.success) throw new ForbiddenError("propertyId invalide");
  const property = await prisma.property.findUnique({ where: { id: parsed.data } });
  if (!property || property.user_id !== userId) {
    throw new ForbiddenError("Propriété non autorisée");
  }
  return parsed.data;
}

/** Vérifie l'accès à une propriété (owner). */
export async function requirePropertyAccess(propertyId: string): Promise<{
  user: SessionUser;
  propertyId: string;
}> {
  const { user } = await requireSession();
  const propertyIdOk = await verifyPropertyOwnership(user.id, propertyId);
  return { user, propertyId: propertyIdOk };
}

// ---- API Wrappers ----

export type AuthHandler = (args: { req: NextRequest; user: SessionUser }) => Promise<Response> | Response;

export function withAuth(handler: AuthHandler) {
  return async function handlerWithAuth(req: NextRequest): Promise<Response> {
    try {
      const { user } = await requireSession();
      return await handler({ req, user });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return new Response(err.message, { status: 401 });
      }
      if (err instanceof ForbiddenError) {
        return new Response(err.message, { status: 403 });
      }
      throw err;
    }
  };
}

export interface PropertyScopeHandlerArgs {
  req: NextRequest;
  user: SessionUser;
  propertyId: string;
}
export type PropertyScopeHandler = (args: PropertyScopeHandlerArgs) => Promise<Response> | Response;

// Cherche un paramètre dans query (?property=) ou (?propertyId=)
function extractPropertyId(req: NextRequest): string | null {
  const url = new URL(req.url);
  const sp = url.searchParams;
  return sp.get("property") || sp.get("propertyId");
}

export function withPropertyScope(handler: PropertyScopeHandler) {
  return withAuth(async ({ req, user }) => {
    const raw = extractPropertyId(req);
    if (!raw) return new Response("propertyId manquant", { status: 400 });
    try {
      const propertyId = await verifyPropertyOwnership(user.id, raw);
      return handler({ req, user, propertyId });
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return new Response(err.message, { status: 403 });
      }
      throw err;
    }
  });
}
