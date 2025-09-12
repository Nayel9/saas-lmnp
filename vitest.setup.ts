import "@testing-library/jest-dom/vitest";
import { beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";

beforeAll(async () => {
  if (!window.matchMedia) {
    // Polyfill minimal pour color scheme, media queries
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
  // DDL idempotentes pour tests (si db seed sans migration)
  try {
    await prisma.$executeRawUnsafe(
      "DO $$ BEGIN CREATE TYPE \"PaymentStatus\" AS ENUM ('PENDING','PAID','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;",
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" DEFAULT \"PENDING\"',
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP DEFAULT now()',
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "iban" TEXT',
    );
  } catch {
    // ignore DDL errors in CI
  }
});

afterAll(() => {
  vi.clearAllMocks();
});
