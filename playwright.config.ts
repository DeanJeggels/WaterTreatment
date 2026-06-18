import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E for the AquaSim v3 surfaces. Public smoke specs always run;
 * the authenticated guided-design flow runs only when E2E_EMAIL / E2E_PASSWORD
 * are provided (the app's /project/** routes are Supabase-auth-gated).
 *
 * The webServer builds + serves apps/web on :3000 (reuses a running server in dev).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev --workspace=web',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
