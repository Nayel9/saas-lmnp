import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import archiver from "archiver";
import { PassThrough, Readable } from "stream";
import { getObjectStream } from "@/lib/storage/s3";
import {
  buildIndexCsv,
  buildZipPath,
  type IndexRow,
} from "@/lib/exports/attachmentsIndex";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QSchema = z.object({
  propertyId: z.string().uuid({ message: "propertyId invalide" }),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "from invalide" }),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "to invalide" }),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response("Non authentifié", { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = QSchema.safeParse({
    propertyId: searchParams.get("propertyId"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => e.message).join(", ");
    return new Response("BAD_REQUEST: " + msg, { status: 400 });
  }
  const { propertyId, from, to } = parsed.data;

  // Sécurité: vérifier que le bien appartient au user
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });
  if (!property || property.user_id !== user.id) {
    return new Response("FORBIDDEN: propriété inconnue", { status: 403 });
  }

  // Récupérer ventes + achats sur la période (multi-tenant par user)
  const where: Prisma.JournalEntryWhereInput = {
    user_id: user.id,
    date: { gte: new Date(from), lte: new Date(to) },
    OR: [{ type: "vente" }, { type: "achat" }],
  };

  // Note: pas de lien propertyId sur JournalEntry dans le schéma actuel; on vérifie ownership du bien mais on ne filtre pas par bien.
  const entries = await prisma.journalEntry.findMany({
    where,
    orderBy: { date: "asc" },
  });
  const ids = entries.map((e) => e.id);
  const attachments = ids.length
    ? await prisma.attachment.findMany({ where: { entryId: { in: ids } } })
    : [];

  // Construire index.csv
  const entryById = new Map(entries.map((e) => [e.id, e] as const));
  const rows: IndexRow[] = attachments.map((att) => {
    const e = entryById.get(att.entryId!);
    const dateISO = e!.date.toISOString().slice(0, 10);
    return {
      type: e!.type,
      date: dateISO,
      entryId: e!.id,
      montant: Number(e!.amount),
      counterparty: e!.tier || null,
      category: e!.type === "achat" ? e!.account_code || null : null,
      fileName: att.fileName,
      storageKey: att.storageKey,
    };
  });
  const csv = buildIndexCsv(rows);

  // Stream ZIP avec archiver
  const pass = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("warning", (err: unknown) => {
    console.warn("ZIP warn", err);
  });
  archive.on("error", (err: unknown) => {
    pass.destroy(err as Error);
  });
  archive.pipe(pass);

  // Ajouter index.csv
  archive.append(csv, { name: "index.csv" });

  // Ajouter les fichiers
  for (const att of attachments) {
    const e = entryById.get(att.entryId!);
    if (!e) continue;
    const dateISO = e.date.toISOString().slice(0, 10);
    const zipPath = buildZipPath({
      type: e.type,
      dateISO,
      entryId: e.id,
      fileName: att.fileName,
    });
    try {
      const s = await getObjectStream(att.storageKey);
      archive.append(s as unknown as Readable, { name: zipPath });
    } catch (err) {
      console.warn("Skip missing object", att.storageKey, err);
    }
  }

  await archive.finalize();

  const filename = `pieces_${propertyId}_${from}_${to}.zip`;
  // Adapter PassThrough (Node stream) en Web Stream si possible
  const toWeb = (
    Readable as unknown as {
      toWeb?: (s: NodeJS.ReadableStream) => ReadableStream;
    }
  ).toWeb;
  const body = toWeb ? toWeb(pass) : (pass as unknown as ReadableStream);
  console.log("Export pièces ZIP", {
    userId: user.id,
    propertyId,
    from,
    to,
    count: attachments.length,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
