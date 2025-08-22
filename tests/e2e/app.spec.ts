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
  const email = `user2-${Date.now()}@local.test`;
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

async function uiLogout(page: Page) {
  await page.locator('button:has-text("Déconnexion")').click();
  await page.waitForURL(url => /\/login$/.test(url.pathname) || /\/$/.test(url.pathname));
}

const UNIQUE_RUN_ID = Date.now();
function uniq(label: string) { return `${label}-${UNIQUE_RUN_ID}`; }
async function retry<T>(fn:()=>Promise<T>, attempts=3, delay=500): Promise<T> { let lastErr:any; for (let i=0;i<attempts;i++){ try { return await fn(); } catch(e){ lastErr=e; if(i<attempts-1) await new Promise(r=>setTimeout(r,delay)); } } throw lastErr; }
function parseMoney(txt: string): number { const cleaned = txt.replace(/\s|\u202F|\u00A0/g,'').replace(/[^0-9,.-]/g,'').replace(/(,)(?=[0-9]{3}\b)/g,'').replace(',', '.'); const n = parseFloat(cleaned); return isNaN(n)?0:n; }

let achatEditedGlobal: string | undefined;

test.describe.serial('E2E scénario complet', () => {
  test('1) Auth admin login/logout', async ({ page }) => {
    const { email, password } = await ensureAdminCreds();
    await uiLogin(page, email, password);
    await expect(page.locator('h1:has-text("Tableau de bord")')).toBeVisible();
    await uiLogout(page);
  });

  test('2) Journaux achats & ventes CRUD + exports', async ({ page }) => {
    const { email, password } = await ensureAdminCreds();
    await uiLogin(page, email, password);
    await page.goto('/journal/achats');
    await page.locator('button:has-text("Ajouter")').click();
    const achatInitial = uniq('E2E Achat Test');
    const achatEdited = uniq('E2E Achat Modifié');
    achatEditedGlobal = achatEdited;
    await page.fill('input[name="designation"]', achatInitial);
    const achatAccountInput = page.locator('input[aria-label="Recherche compte comptable"]');
    await achatAccountInput.fill('606');
    await page.locator('button:has-text("606 –")').first().click();
    await page.fill('input[name="amount"]', '123.45');
    await page.click('button:has-text("Enregistrer")');
    await expect(page.locator(`td:has-text("${achatInitial}")`)).toBeVisible();

    await page.locator(`tr:has(td:has-text("${achatInitial}")) button:has-text("Edit")`).click();
    await page.fill('input[name="designation"]', achatEdited);
    await page.click('button:has-text("Mettre à jour")');
    await expect(page.locator(`td:has-text("${achatEdited}")`).first()).toBeVisible();
    await expect(page.locator(`td:has-text("${achatInitial}")`)).toHaveCount(0);

    const pdfDownload = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Export PDF")')
    ]);
    const pdfPath = await pdfDownload[0].path();
    expect(pdfPath).toBeTruthy();
    saveDownloadCopy(pdfPath, `journal-achats-${UNIQUE_RUN_ID}.pdf`);

    await page.goto('/journal/ventes');
    await page.locator('button:has-text("Ajouter")').click();
    const venteLabel = uniq('E2E Vente Test');
    // Vérifier que le bouton est initialement activé
    const saveButton = page.locator('button:has-text("Enregistrer")');
    await expect(saveButton).toBeEnabled();

    // Remplir les champs requis
    await page.fill('input[name="designation"]', venteLabel);
    const venteAccInput = page.locator('input[aria-label="Recherche compte comptable"]');
    await venteAccInput.fill('706');
    await page.locator('button:has-text("706 –")').first().click();
    await page.fill('input[name="amount"]', '500');

    // Vérifier que le bouton est activé après remplissage
    await expect(saveButton).toBeEnabled();

    // Cliquer sur le bouton et vérifier la soumission
    await saveButton.click();
    await expect(page.locator(`td:has-text("${venteLabel}")`).first()).toBeVisible();

    await page.goto('/journal/achats');
    await page.locator('button:has-text("Ajouter")').click();
    const achatBad = uniq('Achat Interdit');
    await page.fill('input[name="designation"]', achatBad);
    const achatAccountInput2 = page.locator('input[aria-label="Recherche compte comptable"]');
    await achatAccountInput2.fill('706');
    await achatAccountInput2.press('Enter');
    await page.fill('input[name="amount"]', '10');
    await page.click('button:has-text("Enregistrer")');
    await expect(page.locator('text=Compte réservé aux ventes')).toBeVisible();
    await page.click('button:has-text("Annuler")');

    await page.locator('button:has-text("Ajouter")').click();
    const achatLibre = uniq('Achat Libre 601');
    await page.fill('input[name="designation"]', achatLibre);
    const achatAccountInput3 = page.locator('input[aria-label="Recherche compte comptable"]');
    await achatAccountInput3.fill('601');
    await achatAccountInput3.press('Enter');
    await page.fill('input[name="amount"]', '55');
    await page.click('button:has-text("Enregistrer")');
    await expect(page.locator(`td:has-text("${achatLibre}")`)).toBeVisible();
    await expect(page.locator('td:has-text("601")').first()).toBeVisible();

    await page.goto('/journal/ventes');
    await page.locator('button:has-text("Ajouter")').click();
    const venteBad = uniq('Vente Interdite 606');
    await page.fill('input[name="designation"]', venteBad);
    const venteAccInput2 = page.locator('input[aria-label="Recherche compte comptable"]');
    await venteAccInput2.fill('606');
    await venteAccInput2.press('Enter');
    await page.fill('input[name="amount"]', '10');
    await page.click('button:has-text("Enregistrer")');
    await expect(page.locator('text=Compte réservé aux achats')).toBeVisible();
    await page.click('button:has-text("Annuler")');
  });

  test('3) Immobilisation + amortissement + exports', async ({ page }) => {
    const { email, password } = await ensureAdminCreds();
    await uiLogin(page, email, password);
    await page.goto('/assets');
    await page.locator('button:has-text("Ajouter")').click();
    const submitBtn = page.locator('button:has-text("Enregistrer")');
    await expect(submitBtn).toBeDisabled();
    await page.locator('button:has-text("Annuler")').click();

    const assetLabel = uniq('Machine E2E');
    await page.locator('button:has-text("Ajouter")').click();
    await page.fill('input[name="label"]', assetLabel);
    await page.fill('input[name="amount_ht"]', '20000');
    await page.fill('input[name="duration_years"]', '10');
    await page.fill('input[name="acquisition_date"]', '2024-04-01');
    const accountSearch = page.locator('input[aria-label="Recherche compte comptable"]');
    await accountSearch.fill('2183');
    await page.locator('button:has-text("2183")').first().click();
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await expect(page.locator(`td:has-text("${assetLabel}")`)).toBeVisible();

    await page.locator('button:has-text("Ajouter")').click();
    await page.fill('input[name="label"]', uniq('Asset Invalide 706'));
    await page.fill('input[name="amount_ht"]', '1000');
    await page.fill('input[name="duration_years"]', '5');
    await page.fill('input[name="acquisition_date"]', '2025-01-15');
    const accountSearch2 = page.locator('input[aria-label="Recherche compte comptable"]');
    await accountSearch2.fill('2184');
    await page.locator('button:has-text("2184")').first().click();
    await page.evaluate(() => { const el = document.querySelector('input[type="hidden"][name="account_code"]') as HTMLInputElement | null; if (el) el.value = '706'; });
    await page.locator('button:has-text("Enregistrer")').click();
    await expect(page.locator('text=706')).toBeVisible();
    await page.locator('button:has-text("Annuler")').click();

    await page.click(`tr:has(td:has-text("${assetLabel}")) a:has-text("Voir")`);
    await expect(page.locator(`h1:has-text("Amortissement - ${assetLabel}")`)).toBeVisible();
    const id = page.url().split('/').slice(-2)[0];
    const row2024 = page.locator('tbody tr:has(td:has-text("2024"))');
    await expect(row2024).toBeVisible();
    const dotationCellText = (await row2024.locator('td').nth(1).innerText()).trim();
    const normalized = dotationCellText.replace(/[\u202F\u00A0\s]/g,'');
    const numeric = parseFloat(normalized.replace('.', '').replace(',', '.'));
    expect(numeric).toBeGreaterThan(1499);
    expect(numeric).toBeLessThan(1501);
    const csvDownload = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Export CSV")')
    ]);
    const csvPath = await csvDownload[0].path();
    expect(csvPath).toBeTruthy();
    saveDownloadCopy(csvPath, `amort-${id}-${UNIQUE_RUN_ID}.csv`);

    const xlsxResp = await retry(()=>page.request.get(`/api/assets/${id}/amortization/export?format=xlsx`));
    expect(xlsxResp.ok()).toBeTruthy();
    const xlsxBuf = await xlsxResp.body();
    expect(xlsxBuf.byteLength).toBeGreaterThan(200);
    saveBuffer(Buffer.from(xlsxBuf), `amort-${id}-${UNIQUE_RUN_ID}.xlsx`);
  });

  test('4) Rapports Balance & Grand Livre', async ({ page }) => {
    const { email, password } = await ensureAdminCreds();
    await uiLogin(page, email, password);
    await page.goto('/reports/balance');
    await expect(page.locator('table')).toBeVisible();
    const balCsv = await Promise.all([page.waitForEvent('download'), page.click('a:has-text("Export CSV")')]);
    expect(await balCsv[0].path()).toBeTruthy();
    saveDownloadCopy(await balCsv[0].path(), `balance-${UNIQUE_RUN_ID}.csv`);
    const balPdf = await Promise.all([page.waitForEvent('download'), page.click('a:has-text("Export PDF")')]);
    const balPdfPath = await balPdf[0].path();
    expect(balPdfPath).toBeTruthy();
    if (balPdfPath) saveDownloadCopy(balPdfPath, `balance-${UNIQUE_RUN_ID}.pdf`);

    const rowCount = await page.locator('tbody tr').count();
    if (rowCount > 0) {
      const footerDebit = parseMoney(await page.locator('tfoot td').nth(1).innerText());
      const footerCredit = parseMoney(await page.locator('tfoot td').nth(2).innerText());
      const footerBalance = parseMoney(await page.locator('tfoot td').nth(3).innerText());
      expect(Number((footerDebit - footerCredit).toFixed(2))).toBe(Number(footerBalance.toFixed(2)));
    }

    const firstAccount = page.locator('tbody tr td:first-child').first();
    const accText = await firstAccount.textContent();
    if (accText) {
      await page.click(`a[href*="/reports/ledger?account_code=${accText.trim()}"]`);
      await expect(page.locator('h1:has-text("Grand livre")')).toBeVisible();
      const ledgerCsv = await Promise.all([page.waitForEvent('download'), page.click('a:has-text("Export CSV")')]);
      expect(await ledgerCsv[0].path()).toBeTruthy();
      saveDownloadCopy(await ledgerCsv[0].path(), `ledger-${UNIQUE_RUN_ID}.csv`);
    }

    await page.goto('/reports/2033c');
    await expect(page.locator('h1:has-text("Compte de résultat 2033-C")')).toBeVisible();
    const export2033c = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Export XLSX")')
    ]);
    expect(await export2033c[0].path()).toBeTruthy();

    await page.goto('/reports/2033e');
    await expect(page.locator('h1:has-text("État des amortissements 2033-E")')).toBeVisible();
    const export2033e = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Export XLSX")')
    ]);
    expect(await export2033e[0].path()).toBeTruthy();

    await page.goto('/reports/2033a');
    await expect(page.locator('h1:has-text("Bilan simplifié 2033-A")')).toBeVisible();
    const export2033a = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Export XLSX")')
    ]);
    expect(await export2033a[0].path()).toBeTruthy();
  });

  test('5) Isolation second utilisateur', async ({ browser }) => {
    await ensureAdminCreds();
    const user2 = await createIsolatedUser();
    const context = await browser.newContext();
    const page = await context.newPage();
    await uiLogin(page, user2.email, user2.password);
    await page.goto('/journal/achats');
    await expect(page.locator(`td:has-text("${achatEditedGlobal||''}")`)).toHaveCount(0);
    await context.close();
  });
});

const ARTIFACT_DIR = path.join(process.cwd(), 'e2e-artifacts');
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR);
function saveDownloadCopy(srcPath: string | null, targetBase: string) { if (!srcPath) return; const dest = path.join(ARTIFACT_DIR, targetBase); try { fs.copyFileSync(srcPath, dest); } catch { /* ignore */ } }
function saveBuffer(buf: Buffer, targetBase: string){ const dest = path.join(ARTIFACT_DIR, targetBase); try { fs.writeFileSync(dest, buf); } catch {/* ignore */} }
