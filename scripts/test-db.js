// Test simple de connexion Prisma (CommonJS) avec fallback direct
require("dotenv/config");
const { PrismaClient } = require("@prisma/client");

async function tryMode(label, envVar) {
  const url = process.env[envVar];
  if (!url) {
    console.error(`[${label}] URL absente (${envVar})`);
    return false;
  }
  console.log(`\n=== Mode ${label} (${envVar}) ===`);
  console.log("URL:", url.replace(/:[^:@/]+@/, ":****@"));
  // Force variable principale pour Prisma (il lit toujours DATABASE_URL, directUrl est interne)
  if (envVar === "DIRECT_URL") process.env.DATABASE_URL = url;
  const prisma = new PrismaClient();
  try {
    const now = await prisma.$queryRaw`SELECT now()`;
    console.log("Connexion OK → now() =", now);
    const props = await prisma.property.findMany({ take: 1 });
    console.log("Property sample:", props);
    return true;
  } catch (e) {
    console.error("Échec Prisma:", e.code || e.name, e.message);
    if (e.code === "P1001")
      console.error(
        "Hint: test réseau (db:diagnose) ou firewall / mauvais mot de passe.",
      );
    return false;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

(async () => {
  // 1. Essai pooler (DATABASE_URL)
  const poolOk = await tryMode("POOLER", "DATABASE_URL");
  if (poolOk) return;
  // 2. Fallback direct
  const directOk = await tryMode("DIRECT", "DIRECT_URL");
  if (directOk) return;
  console.error("\nAucun mode n'a fonctionné. Lancer: pnpm db:diagnose");
})();
