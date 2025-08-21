import { test, expect } from '@playwright/test';

// Flux complet inscription -> récupération token debug -> vérification -> login

test('Flux inscription / vérification / login avec affichage prénom', async ({ page, request }) => {
  const unique = Date.now();
  const email = `e2e-signup-${unique}@local.test`;
  const password = 'Passw0rd!';
  const firstName = 'Claire';
  const lastName = 'Durand';
  const phone = '06 11 22 33 44';

  await page.goto('/login');
  await page.getByRole('tab', { name: 'Créer un compte' }).click();
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.fill('#confirmPassword', password);
  await page.fill('#firstName', firstName);
  await page.fill('#lastName', lastName);
  await page.fill('#phone', phone);
  await page.check('#acceptTerms');
  await page.click('button[type="submit"]');

  // Nouvelle UX: modale de vérification apparaît
  await expect(page.getByRole('dialog', { name: /Vérifiez vos emails/i })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  // Récupération du token de vérification via endpoint debug
  const debugResp = await request.get(`/api/auth/debug/verification-token?email=${encodeURIComponent(email)}`);
  expect(debugResp.ok()).toBeTruthy();
  const data = await debugResp.json();
  expect(data.token).toBeTruthy();

  // Vérification
  await page.goto(`/auth/verify?token=${encodeURIComponent(data.token)}&email=${encodeURIComponent(email)}`);
  await page.waitForURL(/login\?verified=1/);
  await expect(page.getByText('Email vérifié, vous pouvez maintenant vous connecter.')).toBeVisible();

  // Login
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/);
  await expect(page.locator('h1:has-text("Tableau de bord")')).toBeVisible();

  // NavBar affiche prénom
  await expect(page.getByRole('navigation').getByText('Claire Durand', { exact: true })).toBeVisible();
});
