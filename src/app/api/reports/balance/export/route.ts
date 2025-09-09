import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/core";
import { getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateBalancePdf } from "@/lib/balance-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RawRow {
  account_code: string;
  total_debit: unknown;
  total_credit: unknown;
}
function parseNum(n: unknown): number {
  if (typeof n === "number") return n;
  if (typeof n === "string") {
    const v = parseFloat(n);
    return isNaN(v) ? 0 : v;
  }
  if (n && typeof n === "object" && "toString" in n) {
    const v = parseFloat((n as { toString(): string }).toString());
    return isNaN(v) ? 0 : v;
  }
  return 0;
}

type SQLValue = string | number | Date;

async function fetchAggregated(
  userId: string,
  params: {
    from?: string | null;
    to?: string | null;
    account_code?: string | null;
    q?: string | null;
  },
) {
  const { from, to, account_code, q } = params;
  const whereParts = ["user_id = $1"];
  const values: SQLValue[] = [userId];
  let idx = 2;
  if (from) {
    whereParts.push(`date >= $${idx++}`);
    values.push(new Date(from));
  }
  if (to) {
    whereParts.push(`date <= $${idx++}`);
    values.push(new Date(to));
  }
  if (account_code) {
    whereParts.push(`account_code ILIKE $${idx++}`);
    values.push("%" + account_code + "%");
  }
  if (q) {
    whereParts.push(
      `(designation ILIKE $${idx} OR tier ILIKE $${idx} OR account_code ILIKE $${idx})`,
    );
    values.push("%" + q + "%");
    idx++;
  }
  const sql = `SELECT account_code, 
    SUM(CASE WHEN type='achat' THEN amount ELSE 0 END) AS total_debit,
    SUM(CASE WHEN type='vente' THEN amount ELSE 0 END) AS total_credit
    FROM journal_entries
    WHERE ${whereParts.join(" AND ")}
    GROUP BY account_code
    ORDER BY account_code`;
  const rows = await prisma.$queryRawUnsafe<RawRow[]>(sql, ...values);
  return rows.map((r) => ({
    account_code: r.account_code,
    total_debit: parseNum(r.total_debit),
    total_credit: parseNum(r.total_credit),
    balance: parseNum(r.total_debit) - parseNum(r.total_credit),
  }));
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (getUserRole(user) !== "admin")
    return new Response("Forbidden", { status: 403 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const account_code = searchParams.get("account_code");
  const q = searchParams.get("q");

  const rows = await fetchAggregated(user.id, { from, to, account_code, q });

  if (format === "csv") {
    const header = "account_code;total_debit;total_credit;balance\n";
    const body = rows
      .map((r) =>
        [
          r.account_code,
          r.total_debit.toFixed(2),
          r.total_credit.toFixed(2),
          r.balance.toFixed(2),
        ].join(";"),
      )
      .join("\n");
    return new Response(header + body + (body ? "\n" : ""), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="balance.csv"',
      },
    });
  }
  // PDF (troncation si >5000)
  const MAX_PDF_ROWS = 5000;
  const truncated = rows.length > MAX_PDF_ROWS;
  const pdfBuf = await generateBalancePdf({
    rows: truncated ? rows.slice(0, MAX_PDF_ROWS) : rows,
    period: { from, to },
    filters: { account_code, q },
  });
  return new Response(new Uint8Array(pdfBuf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="balance.pdf"',
      ...(truncated ? { "X-Truncated": "true" } : {}),
    },
  });
}
