import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

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
    await page.fill('input[name="designation"]', 'E2E Achat Test');
    await page.fill('input[name="account_code"]', '606');
    await page.fill('input[name="amount"]', '123.45');
    await page.click('button:has-text("Enregistrer")');
    await expect(page.locator('td:has-text("E2E Achat Test")')).toBeVisible();

    // Editer
    await page.locator('tr:has(td:has-text("E2E Achat Test")) button:has-text("Edit")').click();
    await page.fill('input[name="designation"]', 'E2E Achat Modifié');
    await page.click('button:has-text("Mettre à jour")');
    await expect(page.locator('td:has-text("E2E Achat Modifié")')).toBeVisible();

    // Export PDF (download)
    const pdfDownload = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Export PDF")')
    ]);
    const pdfSize = (await pdfDownload[0].createReadStream())?.readableLength ?? 0;
    expect(pdfSize).toBeGreaterThan(0);

    // Ventes
    await page.goto('/journal/ventes');
    await page.locator('button:has-text("Ajouter")').click();
    await page.fill('input[name="designation"]', 'E2E Vente Test');
    await page.fill('input[name="account_code"]', '706');
    await page.fill('input[name="amount"]', '500');
    await page.click('button:has-text("Enregistrer")');
    await expect(page.locator('td:has-text("E2E Vente Test")')).toBeVisible();

    // Export XLSX ventes
    const xlsxDownload = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Export XLSX")')
    ]);
    const xlsxPath = await xlsxDownload[0].path();
    expect(xlsxPath).toBeTruthy();
  });

  test('3) Immobilisation + amortissement + exports', async ({ page }) => {
    const { email, password } = await ensureAdminCreds();
    await uiLogin(page, email, password);
    await page.goto('/assets');
    await page.locator('button:has-text("Ajouter")').click();
    await page.fill('input[name="label"]', 'Machine E2E');
    await page.fill('input[name="amount_ht"]', '20000');
    await page.fill('input[name="duration_years"]', '10');
    await page.fill('input[name="acquisition_date"]', '2024-04-01');
    await page.fill('input[name="account_code"]', '215');
    await page.click('button:has-text("Enregistrer")');
    await expect(page.locator('td:has-text("Machine E2E")')).toBeVisible();
    // Ouvrir amortissement
    await page.click('tr:has(td:has-text("Machine E2E")) a:has-text("Voir")');
    await expect(page.locator('h1:has-text("Amortissement - Machine E2E")')).toBeVisible();
    // Vérifier dotation 2024 = 1500,00
    await expect(page.locator('tr:has(td:has-text("2024")) td:text-matches("/1.500,00|1 500,00|1500,00/")')).toBeVisible();
    // Export CSV
    const csvDownload = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Export CSV")')
    ]);
    expect(await csvDownload[0].path()).toBeTruthy();
    // Export XLSX
    const id = page.url().split('/').slice(-2)[0];
    createdAssetId = id;
    const xlsxDownload = await Promise.all([
      page.waitForEvent('download'),
      page.goto(`/api/assets/${id}/amortization/export?format=xlsx`)
    ]);
    expect(await xlsxDownload[0].path()).toBeTruthy();
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
    const balPdf = await Promise.all([page.waitForEvent('download'), page.click('a:has-text("Export PDF")')]);
    expect(await balPdf[0].path()).toBeTruthy();

    // Grand Livre (ouvrir via lien première ligne si existe)
    const firstAccount = page.locator('tbody tr td:first-child').first();
    const accText = await firstAccount.textContent();
    if (accText) {
      await page.click(`a[href*="/reports/ledger?account_code=${accText.trim()}"]`);
      await expect(page.locator('h1:has-text("Grand Livre")')).toBeVisible();
      const ledgerCsv = await Promise.all([page.waitForEvent('download'), page.click('a:has-text("Export CSV")')]);
      expect(await ledgerCsv[0].path()).toBeTruthy();
    }
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
    await expect(page.locator('td:has-text("E2E Achat Modifié")')).toHaveCount(0);
    await context.close();
  });
});
