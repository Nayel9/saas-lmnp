import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function ensureAdminCreds() {
  let email = process.env.ADMIN_SEED_EMAIL;
  let password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password) {
    email = `admin-e2e-${Date.now()}@local.test`;
    password = 'Passw0rd!';
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  const hash = await bcrypt.hash(password, 10);
  if (!existing) {
    await prisma.user.create({ data: { email, password: hash, role: 'admin', emailVerified: new Date(), termsAcceptedAt: new Date() } });
  } else if (existing.role !== 'admin' || !existing.password || !existing.emailVerified) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'admin', password: hash, emailVerified: existing.emailVerified || new Date() } });
  }
  return { email: email!, password: password! };
}

async function createIsolatedUser(): Promise<{ email: string; password: string }> {
  const email = `user-attach-${Date.now()}@local.test`;
  const password = 'Passw0rd!';
  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, password: hash, role: 'user', emailVerified: new Date(), termsAcceptedAt: new Date() } });
  return { email, password };
}

async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor();
  await emailInput.fill(email);
  const pwdInput = page.locator('input[type="password"]');
  await pwdInput.fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/.*dashboard.*/);
}

function ensureTmpFile(name: string, bytes: Buffer) {
  const dir = path.join(process.cwd(), 'e2e-artifacts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, bytes);
  return p;
}

function minimalPdf(): Buffer { return Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'); }
function minimalJpg(): Buffer { return Buffer.from([0xFF,0xD8,0xFF,0xD9]); }
function minimalTxt(): Buffer { return Buffer.from('hello'); }

function rowByLabel(page: Page, label: string) {
  return page.locator(`tr:has(td:has-text("${label}"))`);
}

async function createEntryWithLabel(page: Page, url: string, label: string, account: string, amount: string) {
  await page.goto(url);
  await page.locator('button:has-text("Ajouter")').click();
  await page.fill('input[name="designation"]', label);
  const accInput = page.locator('input[aria-label="Recherche compte comptable"]');
  await accInput.fill(account);
  await accInput.press('Enter');
  await page.fill('input[name="amount"]', amount);
  await page.click('button:has-text("Enregistrer")');
  await expect(page.locator(`td:has-text("${label}")`).first()).toBeVisible();
}

test.describe.serial('Pièces jointes – E2E', () => {
  test('1) Vente: upload PDF et téléchargement', async ({ page }) => {
    const { email, password } = await ensureAdminCreds();
    await uiLogin(page, email, password);
    const label = `Vente PJ ${Date.now()}`;
    await createEntryWithLabel(page, '/journal/ventes', label, '706', '42');

    const row = rowByLabel(page, label);
    const clipBtn = row.locator('button:has-text("📎")');
    await clipBtn.click();
    const pdfPath = ensureTmpFile('sample.pdf', minimalPdf());
    await page.setInputFiles('input[type="file"]', pdfPath);
    await expect(page.locator('td:has-text("sample.pdf")')).toBeVisible();
    await page.locator('button:has-text("Fermer")').click();
    await expect(row.locator('button:has-text("📎 1")')).toBeVisible();

    // Réouvrir et télécharger
    await clipBtn.click();
    const download = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Télécharger")')
    ]);
    const pathDl = await download[0].path();
    expect(pathDl).toBeTruthy();
  });

  test('2) Achat: upload JPG, lister et télécharger', async ({ page }) => {
    const { email, password } = await ensureAdminCreds();
    await uiLogin(page, email, password);
    const label = `Achat PJ ${Date.now()}`;
    await createEntryWithLabel(page, '/journal/achats', label, '606', '12');

    const row = rowByLabel(page, label);
    await row.locator('button:has-text("📎")').click();
    const jpgPath = ensureTmpFile('sample.jpg', minimalJpg());
    await page.setInputFiles('input[type="file"]', jpgPath);
    await expect(page.locator('td:has-text("sample.jpg")')).toBeVisible();
    const dl = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Télécharger")')
    ]);
    expect(await dl[0].path()).toBeTruthy();
  });

  test('3) Erreur type interdit .txt', async ({ page }) => {
    const { email, password } = await ensureAdminCreds();
    await uiLogin(page, email, password);
    const label = `Achat Bad ${Date.now()}`;
    await createEntryWithLabel(page, '/journal/achats', label, '606', '5');

    const row = rowByLabel(page, label);
    await row.locator('button:has-text("📎")').click();
    const txtPath = ensureTmpFile('bad.txt', minimalTxt());
    await page.setInputFiles('input[type="file"]', txtPath);
    await expect(page.getByText(/Upload échoué|Pré-signature échouée/)).toBeVisible();
  });

  test('4) Protection multi-utilisateurs (download interdit)', async ({ browser }) => {
    const { email, password } = await ensureAdminCreds();
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await uiLogin(pageA, email, password);
    const label = `Vente Protect ${Date.now()}`;
    await createEntryWithLabel(pageA, '/journal/ventes', label, '706', '15');
    const row = rowByLabel(pageA, label);
    await row.locator('button:has-text("📎")').click();
    const pdfPath = ensureTmpFile('protect.pdf', minimalPdf());
    await pageA.setInputFiles('input[type="file"]', pdfPath);
    const link = pageA.locator('a:has-text("Télécharger")').first();
    const href = await link.getAttribute('href');

    const userB = await createIsolatedUser();
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await uiLogin(pageB, userB.email, userB.password);
    const res = await pageB.request.get(href!);
    expect(res.status()).toBeGreaterThanOrEqual(403);

    await contextA.close();
    await contextB.close();
  });
});

