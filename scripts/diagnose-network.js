// Diagnostic réseau bas niveau (DNS + TCP) pour host Postgres Supabase
require("dotenv/config");
const dns = require("dns");
const net = require("net");

const directUrl = process.env.DATABASE_URL || "";
const poolUrl = process.env.POOLER_DATABASE_URL || "";

function parse(url) {
  const m = url.match(/postgresql:\/\/[^@]+@([^/:]+):(\d+)/);
  if (!m) return null;
  return { host: m[1], port: parseInt(m[2], 10) };
}

const targets = [];
const p1 = parse(directUrl);
if (p1) targets.push({ label: "DIRECT", ...p1 });
const p2 = parse(poolUrl);
if (p2) targets.push({ label: "POOLER", ...p2 });

if (!targets.length) {
  console.error(
    "Aucune URL valide trouvée (DATABASE_URL ou POOLER_DATABASE_URL).",
  );
  process.exit(1);
}

(async () => {
  for (const t of targets) {
    console.log(`\n=== Test ${t.label} ${t.host}:${t.port} ===`);
    // DNS
    try {
      const addrs = await new Promise((res, rej) =>
        dns.resolve4(t.host, (e, a) => (e ? rej(e) : res(a))),
      );
      console.log("DNS A:", addrs.join(", "));
    } catch (e) {
      console.error("DNS échec:", e.code || e.message);
    }
    // TCP
    await new Promise((resolve) => {
      const start = Date.now();
      const sock = net.createConnection({
        host: t.host,
        port: t.port,
        timeout: 8000,
      });
      sock.on("connect", () => {
        console.log("TCP OK en", Date.now() - start, "ms");
        sock.destroy();
        resolve();
      });
      sock.on("timeout", () => {
        console.error("TCP timeout");
        sock.destroy();
        resolve();
      });
      sock.on("error", (e) => {
        console.error("TCP erreur:", e.code || e.message);
        resolve();
      });
    });
  }
})();
