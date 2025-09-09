// ensure-admin.js (NextAuth v5) : crée ou met à jour un utilisateur admin dans la base Prisma
require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const email = process.env.ADMIN_SEED_EMAIL;
const password = process.env.ADMIN_SEED_PASSWORD;
if (!email || !password) {
  console.error("ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD manquants");
  process.exit(1);
}

(async () => {
  try {
    const hash = await bcrypt.hash(password, 10);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      const created = await prisma.user.create({
        data: {
          email,
          password: hash,
          role: "admin",
          name: "Admin Seed",
          emailVerified: new Date(),
          termsAcceptedAt: new Date(),
        },
      });
      console.log("Admin créé:", created.id);
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          password: hash,
          role: "admin",
          emailVerified: existing.emailVerified || new Date(),
          termsAcceptedAt: existing.termsAcceptedAt || new Date(),
        },
      });
      console.log("Admin mis à jour:", existing.id);
    }
    process.exit(0);
  } catch (e) {
    console.error("Erreur ensure-admin:", e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
