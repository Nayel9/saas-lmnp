import { test, expect, type Page} from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

const prisma = new PrismaClient();

async function ensureAdminCreds() {
  let email = process.env.ADMIN_SEED_EMAIL;
  let password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password) {
    email = `admin-e2e-${Date.now()}@local.test`;
    password = "Passw0rd!";
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  const hash = await bcrypt.hash(password, 10);
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        password: hash,
        role: "admin",
        emailVerified: new Date(),
        termsAcceptedAt: new Date(),
      },
    });
  } else if (
    existing.role !== "admin" ||
    !existing.password ||
    !existing.emailVerified
  ) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "admin",
        password: hash,
        emailVerified: existing.emailVerified || new Date(),
      },
    });
  }
  return { email: email!, password: password! };
}

async function createIsolatedUser(): Promise<{
  email: string;
  password: string;
}> {
  const email = `user-export-${Date.now()}@local.test`;
  const password = "Passw0rd!";
  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      password: hash,
      role: "user",
      emailVerified: new Date(),
      termsAcceptedAt: new Date(),
    },
  });
  return { email, password };
}

async function uiLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor();
  await emailInput.fill(email);
  const pwdInput = page.locator('input[type="password"]');
  await pwdInput.fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/.*dashboard.*/);
}

function ensureTmpFile(name: string, bytes: Buffer) {
  const dir = path.join(process.cwd(), "e2e-artifacts");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, bytes);
  return p;
}

function minimalPdf(): Buffer {
  return Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
}
function minimalPng(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

async function createProperty(page: Page, label: string) {
  await page.goto("/dashboard");
  await page.fill('input[name="label"]', label);
  await page.click('button:has-text("Ajouter")');
}

// Helper: select ledger account by code depending on page
async function selectLedgerByCode(page: Page, url: string, code: string) {
  const kind = url.includes("ventes") || code.startsWith("7") ? "REVENUE" : "EXPENSE";
  const aria = kind === "REVENUE" ? "Compte de produits" : "Compte de charges";
  await page.waitForSelector(`select[aria-label="${aria}"]`);
  await page.evaluate(({ aria, code }) => {
    const sel = document.querySelector(`select[aria-label="${aria}"]`) as HTMLSelectElement | null;
    if (!sel) return;
    const idx = Array.from(sel.options).findIndex((o) => (o.textContent || "").includes(code));
    if (idx > 0) { sel.selectedIndex = idx; sel.dispatchEvent(new Event("change", { bubbles: true })); }
  }, { aria, code });
}

async function createEntryWithLabel(
  page: Page,
  url: string,
  label: string,
  account: string,
  amount: string,
) {
  await page.goto(url);
  await page.locator('button:has-text("Ajouter")').click();
  await page.fill('input[name="designation"]', label);
  await selectLedgerByCode(page, url, account);
  await page.fill('input[name="amount"]', amount);
  await page.click('button:has-text("Enregistrer")');
  await expect(page.locator(`td:has-text("${label}")`).first()).toBeVisible();
}

async function attachToRow(page: Page, rowLabel: string, filePath: string) {
  const row = page.locator(`tr:has(td:has-text("${rowLabel}"))`);
  const clipBtn = row.locator('button:has-text("📎")');
  await clipBtn.click();
  await page.setInputFiles('input[type="file"]', filePath);
  await expect(
    page.locator(`td:has-text("${path.basename(filePath)}")`),
  ).toBeVisible();
  await page.locator('button:has-text("Fermer")').click();
}

test.describe.serial("Exports pièces (ZIP) – E2E", () => {
  test("1) Cas heureux: export du mois avec index.csv", async ({ page }) => {
    const { email, password } = await ensureAdminCreds();
    await uiLogin(page, email, password);

    // Créer un bien
    const label = `Bien ZIP ${Date.now()}`;
    await createProperty(page, label);

    // Créer 2 écritures avec pièces
    const l1 = `Vente ZIP ${Date.now()}`;
    await createEntryWithLabel(page, "/journal/ventes", l1, "706", "50");
    const pdfPath = ensureTmpFile("zip1.pdf", minimalPdf());
    await attachToRow(page, l1, pdfPath);

    const l2 = `Achat ZIP ${Date.now()}`;
    await createEntryWithLabel(page, "/journal/achats", l2, "606", "12");
    const pngPath = ensureTmpFile("zip2.png", minimalPng());
    await attachToRow(page, l2, pngPath);

    // Aller à /exports et déclencher l'export du mois
    await page.goto("/exports");
    const select = page.locator("select");
    await expect(select).toBeVisible();
    // sélectionne le bien en dernier (celui qu'on vient d'ajouter)
    const options = await select.locator("option").allTextContents();
    const idx = options.findIndex((t) => t.includes(label));
    if (idx >= 0) await select.selectOption({ index: idx });

    const download = await Promise.all([
      page.waitForEvent("download"),
      page.click('button:has-text("Exporter pièces (ZIP)")'),
    ]);
    const filePath = await download[0].path();
    expect(filePath).toBeTruthy();

    const zip = new AdmZip(filePath!);
    const entries = zip
      .getEntries()
      .map((e: { entryName: any }) => e.entryName);
    expect(entries).toContain("index.csv");
    // au moins 3: index + 2 fichiers
    expect(entries.length).toBeGreaterThanOrEqual(3);
  });

  test("2) Sécurité: autre utilisateur ne peut pas exporter le bien d’un autre", async ({
    browser,
  }) => {
    const { email, password } = await ensureAdminCreds();
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await uiLogin(pageA, email, password);

    const owner = await prisma.user.findUnique({ where: { email } });
    const prop = await prisma.property.create({
      data: { user_id: owner!.id, label: "Bien Privé", address: null },
    });

    // User B
    const userB = await createIsolatedUser();
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await uiLogin(pageB, userB.email, userB.password);

    const from = new Date();
    const to = new Date();
    const qs = new URLSearchParams({
      propertyId: prop.id,
      from: toISO(from),
      to: toISO(to),
    });
    const res = await pageB.request.get(
      "/api/exports/attachments.zip?" + qs.toString(),
    );
    expect(res.status()).toBe(403);

    await contextA.close();
    await contextB.close();
  });

  test("3) Période sans pièces: ZIP avec seulement index.csv", async ({
    page,
  }) => {
    const { email, password } = await ensureAdminCreds();
    await uiLogin(page, email, password);

    const owner = await prisma.user.findUnique({ where: { email } });
    const props = await prisma.property.findMany({
      where: { user_id: owner!.id },
      take: 1,
    });
    let propId = props[0]?.id;
    if (!propId) {
      const created = await prisma.property.create({
        data: { user_id: owner!.id, label: "Bien Vide", address: null },
      });
      propId = created.id;
    }

    // période lointaine sans pièces
    const qs = new URLSearchParams({
      propertyId: propId!,
      from: "2000-01-01",
      to: "2000-01-31",
    });
    const dl = await page.request.get(
      "/api/exports/attachments.zip?" + qs.toString(),
    );
    expect(dl.status()).toBe(200);
    const buf = Buffer.from(await dl.body());
    const tmp = ensureTmpFile("empty.zip", buf);
    const zip = new AdmZip(tmp);
    const names = zip.getEntries().map((e: { entryName: any }) => e.entryName);
    expect(names).toContain("index.csv");
    // uniquement index.csv
    expect(names.filter((n: string) => !n.endsWith("/")).length).toBe(1);
  });
});

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
