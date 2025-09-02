import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  workers: isCI ? 1 : undefined,
  outputDir: 'test-results/pw',
  reporter: isCI
    ? [
        ['list'],
        ['junit', { outputFile: 'test-results/junit-e2e.xml' }],
        ['html', { outputFolder: 'playwright-report', open: 'never' }]
      ]
    : [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }]
      ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  globalSetup: './tests/e2e/global-setup.ts',
  webServer: {
    command: isCI ? 'pnpm build && pnpm start' : 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 180_000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
