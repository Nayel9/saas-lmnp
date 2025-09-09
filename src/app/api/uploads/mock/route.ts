import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function localPathFor(storageKey: string) {
  const base = path.join(process.cwd(), ".uploads");
  return path.join(base, storageKey.replace(/^mock\//, ""));
}

export async function PUT(req: NextRequest) {
  const storageKey = req.headers.get("x-storage-key") || "";
  if (!storageKey || !storageKey.startsWith("mock/")) {
    return new Response("Bad Request", { status: 400 });
  }
  const filePath = localPathFor(storageKey);
  const dir = path.dirname(filePath);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const buf = Buffer.from(await req.arrayBuffer());
    fs.writeFileSync(filePath, buf);
    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Upload mock failed", err);
    return new Response("Server Error", { status: 500 });
  }
}
