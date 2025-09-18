import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";
import { AccountKind, Prisma } from "@prisma/client";

export const runtime = "nodejs";

const DEFAULT_ACCOUNTS: Array<{
  code: string;
  label: string;
  kind: AccountKind;
  isEditable?: boolean;
}> = [
  // Dépôts / cautions (utilisé pour isDeposit)
  { code: "165", label: "Dépôts et cautions reçus", kind: "LIABILITY", isEditable: false },
  // Produits (ventes)
  { code: "706", label: "Prestations de services (loyers)", kind: "REVENUE" },
  { code: "707", label: "Ventes de marchandises", kind: "REVENUE" },
  { code: "708", label: "Produits des activités annexes", kind: "REVENUE" },
  { code: "709", label: "Rabais, remises et ristournes accordés", kind: "REVENUE" },
  // Charges (achats)
  { code: "601", label: "Achats de matières premières", kind: "EXPENSE" },
  { code: "606", label: "Achats non stockés de matières et fournitures", kind: "EXPENSE" },
  { code: "6063", label: "Petit matériel et outillage", kind: "EXPENSE" },
  { code: "613", label: "Locations", kind: "EXPENSE" },
  { code: "615", label: "Entretien et réparations", kind: "EXPENSE" },
  { code: "616", label: "Primes d’assurances", kind: "EXPENSE" },
  { code: "618", label: "Divers (documentation, logiciels)", kind: "EXPENSE" },
  { code: "62", label: "Autres services extérieurs", kind: "EXPENSE" },
  { code: "627", label: "Services bancaires", kind: "EXPENSE" },
  { code: "635", label: "Impôts et taxes", kind: "EXPENSE" },
  { code: "6811", label: "Dotations aux amortissements", kind: "EXPENSE" },
];

async function ensureDefaultsSeeded() {
  // Seed uniquement les comptes global (propertyId null)
  const existing = await prisma.ledgerAccount.count({ where: { propertyId: null } });
  if (existing > 0) return;
  await prisma.ledgerAccount.createMany({
    data: DEFAULT_ACCOUNTS.map((a) => ({
      propertyId: null,
      code: a.code,
      label: a.label,
      kind: a.kind,
      isEditable: a.isEditable ?? true,
    })),
    skipDuplicates: true,
  });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const propertyId = url.searchParams.get("property");
  try {
    await ensureDefaultsSeeded();
    const where: Prisma.LedgerAccountWhereInput = propertyId
      ? { OR: [{ propertyId: null }, { propertyId }] }
      : { propertyId: null };
    const accounts = await prisma.ledgerAccount.findMany({
      where,
      select: { id: true, code: true, label: true, kind: true, propertyId: true, isEditable: true },
      orderBy: [{ propertyId: "asc" }, { code: "asc" }],
    });
    return new Response(
      JSON.stringify({ accounts }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[/api/accounts][error]", e);
    return new Response("Server error", { status: 500 });
  }
}
