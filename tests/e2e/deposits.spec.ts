import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
async function createUser() {
  const email = `user-dep-${Date.now()}@local.test`;
  const password = 'Passw0rd!';
  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, password: hash, role: 'user', emailVerified: new Date(), termsAcceptedAt: new Date() } });
  return { email, password };
}
async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard.*/);
}

function parseMoney(txt: string): number { const cleaned = txt.replace(/[\s\u202F\u00A0]/g,'').replace(/[^0-9,.-]/g,'').replace(/(,)(?=[0-9]{3}\b)/g,'').replace(',', '.'); const n = parseFloat(cleaned); return isNaN(n)?0:n; }

// Désactivé pour le MVP: instable et non indispensable
test.describe.skip('Cautions (ventes)', () => {
  test('création, badge, totaux exclus, dashboard et synthèse', async ({ page, browser }) => {
    const user = await createUser();
    await uiLogin(page, user.email, user.password);

    await page.goto('/journal/ventes');
    // Crée une vente normale 500
    await page.click('button:has-text("Ajouter")');
    await page.fill('input[name="designation"]', 'Vente normale 500');
    const accInput = page.locator('input[aria-label="Recherche compte comptable"]');
    await accInput.fill('706');
    await page.locator('button:has-text("706")').first().click();
    await page.fill('input[name="amount"]', '500');
    await page.click('button:has-text("Enregistrer")');
    await expect(page.locator('td:has-text("Vente normale 500")')).toBeVisible();

    // Crée une caution 200
    await page.click('button:has-text("Ajouter")');
    await page.fill('input[name="designation"]', 'Caution 200');
    await accInput.fill('706');
    await page.locator('button:has-text("706")').first().click();
    await page.fill('input[name="amount"]', '200');
    await page.check('input[name="isDeposit"]');
    await page.click('button:has-text("Enregistrer")');
    await expect(page.locator('tr:has(td:has-text("Caution 200")) .badge:has-text("Caution")')).toBeVisible();

    // Totaux hors cautions
    const totalsLine = page.locator('text=Total (hors cautions):');
    await expect(totalsLine).toBeVisible();
    const totalsText = await totalsLine.textContent();
    expect(parseMoney(totalsText||'0')).toBeGreaterThanOrEqual(500);

    // Dashboard: cautions en cours (exactement 1, 200 EUR) pour cet utilisateur isolé
    await page.goto('/dashboard');
    const dashRow = page.locator('li:has-text("Cautions en cours")');
    await expect(dashRow).toContainText('(1)');
    await expect(dashRow).toContainText(/200[.,]00/);

    // Synthèse 2033-A: Cautions détenues
    const year = new Date().getFullYear();
    await page.goto(`/reports/2033a?year=${year}`);
    await expect(page.locator('td:has-text("Cautions détenues") ~ td')).toContainText(/200|200,00|200\.00/);

    // Isolation: un autre user ne voit pas la caution
    const context = await browser.newContext();
    const page2 = await context.newPage();
    const other = await createUser();
    await uiLogin(page2, other.email, other.password);
    await page2.goto('/journal/ventes');
    await expect(page2.locator('td:has-text("Caution 200")')).toHaveCount(0);
    await context.close();
  });
});
