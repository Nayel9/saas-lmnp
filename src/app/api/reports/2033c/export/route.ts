import { auth } from "@/lib/auth/core";
import { getUserRole } from "@/lib/auth";
import { compute2033C } from "@/lib/accounting/compute2033c";
import * as XLSX from "xlsx";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_ROWS = 10000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = searchParams.get("q");
  const account_code = searchParams.get("account_code");
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (getUserRole(user) !== "admin")
    return new Response("Forbidden", { status: 403 });
  const result = await compute2033C({
    userId: user.id,
    from,
    to,
    q,
    account_code,
  });

  // Construire dataset agrégé
  const rows = result.rubriques.map((r) => {
    let montant: number;
    if (r.rubrique === "CA")
      montant = r.total_credit - r.total_debit; // Produits positifs
    else if (r.rubrique === "CA_Moins")
      montant = -(r.total_debit - r.total_credit); // afficher rabais en négatif
    else if (r.rubrique === "DotationsAmortissements")
      montant = r.total_debit - r.total_credit; // charges
    else montant = r.total_debit - r.total_credit; // charges
    return { Rubrique: r.label, Code: r.rubrique, Montant: montant };
  });
  // Totaux
  rows.push({
    Rubrique: "TOTAL PRODUITS",
    Code: "TOTAL_PROD",
    Montant: result.totals.produits,
  });
  rows.push({
    Rubrique: "TOTAL CHARGES",
    Code: "TOTAL_CHARGES",
    Montant: result.totals.charges,
  });
  rows.push({
    Rubrique: "DOTATIONS AMORT.",
    Code: "TOTAL_DOT",
    Montant: result.totals.amortissements,
  });
  rows.push({
    Rubrique: "RESULTAT",
    Code: "RESULTAT",
    Montant: result.totals.resultat,
  });

  let truncated = false;
  let exportRows = rows;
  if (rows.length > MAX_ROWS) {
    truncated = true;
    exportRows = rows.slice(0, MAX_ROWS);
  }

  const wb = XLSX.utils.book_new();
  const metaSheetData = [
    { Cle: "Periode_From", Valeur: from || "" },
    { Cle: "Periode_To", Valeur: to || "" },
    { Cle: "Total_Entries", Valeur: result.count_entries },
    {
      Cle: "Truncated",
      Valeur: truncated || result.truncated ? "true" : "false",
    },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metaSheetData);
  XLSX.utils.book_append_sheet(wb, wsMeta, "Meta");
  const ws = XLSX.utils.json_to_sheet(
    exportRows.map((r) => ({
      Rubrique: r.Rubrique,
      Code: r.Code,
      Montant: typeof r.Montant === "number" ? r.Montant.toFixed(2) : r.Montant,
    })),
  );
  XLSX.utils.book_append_sheet(wb, ws, "2033C");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  const headers: Record<string, string> = {
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": 'attachment; filename="2033c.xlsx"',
  };
  if (truncated || result.truncated) headers["X-Truncated"] = "true";
  return new Response(new Uint8Array(buf), { headers });
}
