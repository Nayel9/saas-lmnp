// Client Prisma singleton avec protection contre recréation en mode dev (HMR)
import { PrismaClient, type Prisma } from "@prisma/client";

// Validation minimale des variables nécessaires côté serveur
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL manquante dans .env");
}
// DIRECT_URL uniquement pour les migrations, pas obligatoire à l'exécution

// Ajouter quelques logs utiles en dev
const log: Prisma.LogLevel[] =
  process.env.NODE_ENV === "development"
    ? ["query", "error", "warn"]
    : ["error", "warn"];

// Utilisation de globalThis pour éviter multiple instances en dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
