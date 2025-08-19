import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // pour création second user

async function ensureAdminCreds() {
  let email = process.env.ADMIN_SEED_EMAIL;
  let password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password) {
    // créer un user admin éphémère si service key dispo
    if (!SERVICE_KEY) throw new Error('ADMIN_SEED_* manquants et pas de SERVICE ROLE key');
    email = `admin-e2e-${Date.now()}@local.test`;
    password = 'Passw0rd!';
    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await supa.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: 'admin' }, app_metadata: { role: 'admin' } });
    if (error) throw error;
    process.env.ADMIN_SEED_EMAIL = email;
    process.env.ADMIN_SEED_PASSWORD = password;
  }
  return { email, password } as { email: string; password: string };
}

async function createIsolatedUser(): Promise<{ email: string; password: string }> {
  if (!SERVICE_KEY) throw new Error('SERVICE ROLE requis pour test RLS');
  const email = `user2-${Date.now()}@local.test`;
  const password = 'Passw0rd!';
  const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await supa.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return { email, password };
}

async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  // Supabase Auth UI: first input email, second password, button with data-provider or label
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor();
  await emailInput.fill(email);
  const pwdInput = page.locator('input[type="password"]');
  await pwdInput.fill(password);
  // submit button (Supabase Auth UI renders button[type=submit])
  await page.locator('button[type="submit"]:not([disabled])').first().click();
  await page.waitForURL(/.*dashboard.*/);
}

async function uiLogout(page: Page) {
  await page.locator('button:has-text("Déconnexion")').click();
  await page.waitForURL(/.*login.*/);
}

const UNIQUE_RUN_ID = Date.now();
function uniq(label: string) { return `${label}-${UNIQUE_RUN_ID}`; }
async function retry<T>(fn:()=>Promise<T>, attempts=3, delay=500): Promise<T> { let lastErr:any; for (let i=0;i<attempts;i++){ try { return await fn(); } catch(e){ lastErr=e; if(i<attempts-1) await new Promise(r=>setTimeout(r,delay)); } } throw lastErr; }
function parseMoney(txt: string): number { const cleaned = txt.replace(/\s|\u202F|\u00A0/g,'').replace(/[^0-9,.-]/g,'').replace(/(,)(?=[0-9]{3}\b)/g,'').replace(',', '.'); const n = parseFloat(cleaned); return isNaN(n)?0:n; }

// Lignes partagées entre tests (RLS)
let achatEditedGlobal: string | undefined;

// Tests en série pour réutiliser les créations
 test.describe.serial('E2E scénario complet', () => {
  let createdAssetId: string | undefined;

  test('1) Auth admin login/logout', async ({ page }) => {
    const { email, password } = await ensureAdminCreds();
    await uiLogin(page, email, password);
    await expect(page.locator('h1:has-text("Tableau de bord")')).toBeVisible();
    await uiLogout(page);
  });

  test('2) Journaux achats & ventes CRUD + exports', async ({ page }) => {
    const { email, password } = await ensureAdminCreds();
    await uiLogin(page, email, password);

    // Achats: créer
    await page.goto('/journal/achats');
    await page.locator('button:has-text("Ajouter")').click();
    const achatInitial = uniq('E2E Achat Test');
    const achatEdited = uniq('E2E Achat Modifié');
    achatEditedGlobal = achatEdited;
    await page.fill('input[name="designation"]', achatInitial);
    await page.fill('input[name="account_code"]', '606');
    await page.fill('input[name="amount"]', '123.45');
    await page.click('button:has-text("Enregistrer")');
    await expect(page.locator(`td:has-text("${achatInitial}")`)).toBeVisible();

    // Editer
    await page.locator(`tr:has(td:has-text("${achatInitial}")) button:has-text("Edit")`).click();
    await page.fill('input[name="designation"]', achatEdited);
    await page.click('button:has-text("Mettre à jour")');
    await expect(page.locator(`td:has-text("${achatEdited}")`).first()).toBeVisible();
    await expect(page.locator(`td:has-text("${achatInitial}")`)).toHaveCount(0);

    // Export PDF (download)
    const pdfDownload = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Export PDF")')
    ]);
    const pdfPath = await pdfDownload[0].path();
    expect(pdfPath).toBeTruthy();
    saveDownloadCopy(pdfPath, `journal-achats-${UNIQUE_RUN_ID}.pdf`);

    // Ventes
    await page.goto('/journal/ventes');
    await page.locator('button:has-text("Ajouter")').click();
    const venteLabel = uniq('E2E Vente Test');
    await page.fill('input[name="designation"]', venteLabel);
    await page.fill('input[name="account_code"]', '706');
    await page.fill('input[name="amount"]', '500');
    await page.click('button:has-text("Enregistrer")');
    await expect(page.locator(`td:has-text("${venteLabel}")`).first()).toBeVisible();

    // Export XLSX ventes
    const xlsxDownload = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Export XLSX")')
    ]);
    const xlsxPath = await xlsxDownload[0].path();
    expect(xlsxPath).toBeTruthy();
    saveDownloadCopy(xlsxPath, `journal-ventes-${UNIQUE_RUN_ID}.xlsx`);
  });

  test('3) Immobilisation + amortissement + exports', async ({ page }) => {
    const { email, password } = await ensureAdminCreds();
    await uiLogin(page, email, password);
    await page.goto('/assets');
    const assetLabel = uniq('Machine E2E');
    await page.locator('button:has-text("Ajouter")').click();
    await page.fill('input[name="label"]', assetLabel);
    await page.fill('input[name="amount_ht"]', '20000');
    await page.fill('input[name="duration_years"]', '10');
    await page.fill('input[name="acquisition_date"]', '2024-04-01');
    await page.fill('input[name="account_code"]', '215');
    await page.click('button:has-text("Enregistrer")');
    await expect(page.locator(`td:has-text("${assetLabel}")`)).toBeVisible();
    await page.click(`tr:has(td:has-text("${assetLabel}")) a:has-text("Voir")`);
    await expect(page.locator('h1:has-text("Amortissement - Machine E2E")')).toBeVisible();
    const id = page.url().split('/').slice(-2)[0];
    // Vérifier dotation 2024 ≈ 1500
    await expect(page.locator('table')).toBeVisible();
    const row2024 = page.locator('tbody tr:has(td:has-text("2024"))');
    await expect(row2024).toBeVisible();
    const dotationCellText = (await row2024.locator('td').nth(1).innerText()).trim();
    // Normaliser: retirer espaces fines / insécables, garder chiffres et séparateurs ., ,
    const normalized = dotationCellText.replace(/[\u202F\u00A0\s]/g,''); // enlever espaces
    const numeric = parseFloat(normalized.replace('.', '').replace(',', '.')); // enlever éventuel séparateur milliers
    expect(numeric).toBeGreaterThan(1499);
    expect(numeric).toBeLessThan(1501);
    // Export CSV
    const csvDownload = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Export CSV")')
    ]);
    const csvPath = await csvDownload[0].path();
    expect(csvPath).toBeTruthy();
    saveDownloadCopy(csvPath, `amort-${id}-${UNIQUE_RUN_ID}.csv`);

    // Export XLSX
    createdAssetId = id;
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
    // Attendre qu'au moins une ligne apparaisse ou vide
    await expect(page.locator('table')).toBeVisible();
    // Exports
    const balCsv = await Promise.all([page.waitForEvent('download'), page.click('a:has-text("Export CSV")')]);
    expect(await balCsv[0].path()).toBeTruthy();
    saveDownloadCopy(await balCsv[0].path(), `balance-${UNIQUE_RUN_ID}.csv`);
    const balPdf = await Promise.all([page.waitForEvent('download'), page.click('a:has-text("Export PDF")')]);
    const balPdfPath = await balPdf[0].path();
    expect(balPdfPath).toBeTruthy();
    if (balPdfPath) {
      saveDownloadCopy(balPdfPath, `balance-${UNIQUE_RUN_ID}.pdf`);
    }

    // Vérification cohérence totaux si au moins une ligne
    const rowCount = await page.locator('tbody tr').count();
    if (rowCount > 0) {
      const footerDebit = parseMoney(await page.locator('tfoot td').nth(1).innerText());
      const footerCredit = parseMoney(await page.locator('tfoot td').nth(2).innerText());
      const footerBalance = parseMoney(await page.locator('tfoot td').nth(3).innerText());
      expect(Number((footerDebit - footerCredit).toFixed(2))).toBe(Number(footerBalance.toFixed(2)));
    }

    // Grand Livre (ouvrir via lien première ligne si existe)
    const firstAccount = page.locator('tbody tr td:first-child').first();
    const accText = await firstAccount.textContent();
    if (accText) {
      await page.click(`a[href*="/reports/ledger?account_code=${accText.trim()}"]`);
      await expect(page.locator('h1:has-text("Grand Livre")')).toBeVisible();
      const ledgerCsv = await Promise.all([page.waitForEvent('download'), page.click('a:has-text("Export CSV")')]);
      expect(await ledgerCsv[0].path()).toBeTruthy();
      saveDownloadCopy(await ledgerCsv[0].path(), `ledger-${UNIQUE_RUN_ID}.csv`);
    }

    // 2033C
    await page.goto('/reports/2033c');
    await expect(page.locator('h1:has-text("Compte de résultat 2033-C")')).toBeVisible();
    const export2033c = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Export XLSX")')
    ]);
    expect(await export2033c[0].path()).toBeTruthy();
  });

  test('5) RLS second utilisateur iso', async ({ browser }) => {
    await ensureAdminCreds();
    const user2 = await createIsolatedUser();
    // Browser context séparé
    const context = await browser.newContext();
    const page = await context.newPage();
    await uiLogin(page, user2.email, user2.password);
    // Journal achats devrait être vide ou sans nos écritures précédentes
    await page.goto('/journal/achats');
    // Absence de la désignation utilisée dans test 2
    await expect(page.locator(`td:has-text("${achatEditedGlobal||''}")`)).toHaveCount(0);
    await context.close();
  });
});

const ARTIFACT_DIR = path.join(process.cwd(), 'e2e-artifacts');
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR);
function saveDownloadCopy(srcPath: string | null, targetBase: string) {
  if (!srcPath) return;
  const dest = path.join(ARTIFACT_DIR, targetBase);
  try { fs.copyFileSync(srcPath, dest); } catch { /* ignore */ }
}
function saveBuffer(buf: Buffer, targetBase: string){ const dest = path.join(ARTIFACT_DIR, targetBase); try { fs.writeFileSync(dest, buf); } catch {/* ignore */} }
