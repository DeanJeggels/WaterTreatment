import { test, expect } from '@playwright/test';

/**
 * Full MLE-MBR guided flow. Runs ONLY when E2E_EMAIL / E2E_PASSWORD are set
 * (routes are Supabase-auth-gated). Exercises: login → new guided project →
 * Design tab → MLE-MBR wizard → generate → 2D layout + 3D + compliance + report.
 */
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

async function newGuidedProject(page: import('@playwright/test').Page, name: string) {
  await page.goto('/project/new');
  await page.getByLabel(/project name/i).fill(name);
  await page.getByRole('button', { name: /guided design/i }).click();
  await page.getByRole('button', { name: /create project/i }).click();
  await page.waitForURL(/\/design\//);
}

test.describe('AquaSim MLE-MBR guided design (authenticated)', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL / E2E_PASSWORD to run the authenticated flow');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/\/dashboard|\/project/);
  });

  test('Design tab is visible alongside Flowsheet and Proposal', async ({ page }) => {
    await newGuidedProject(page, 'E2E MBR Tabs');
    await expect(page.getByRole('link', { name: /flowsheet/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /proposal/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /design/i })).toBeVisible();
  });

  test('wizard validation blocks an impossible temperature range', async ({ page }) => {
    await newGuidedProject(page, 'E2E MBR Validation');
    await page.getByLabel(/min temperature/i).fill('30'); // >= max (25)
    await expect(page.getByText(/minimum temperature must be below maximum/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /generate mle-mbr design/i })).toBeDisabled();
  });

  test('generates an MLE-MBR design with 2D + 3D + compliance', async ({ page }) => {
    await newGuidedProject(page, 'E2E Komani MBR');
    await page.getByRole('button', { name: /generate mle-mbr design/i }).click();

    await expect(page.getByRole('img', { name: /plant layout/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /compliance/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /JSON/i })).toBeVisible();

    // 3D view extrudes the plant (aeration tank + nested MBR cassette).
    await page.getByRole('button', { name: '3D', exact: true }).click();
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  });

  test('client name carries over to the Proposal tab', async ({ page }) => {
    await newGuidedProject(page, 'E2E MBR Carryover');
    await page.getByLabel(/^client/i).fill('Enoch Mgijima LM');
    await page.getByRole('button', { name: /generate mle-mbr design/i }).click();
    await expect(page.getByRole('img', { name: /plant layout/i })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('link', { name: /proposal/i }).click();
    await page.waitForURL(/\/proposal\//);
    await expect(page.getByText('Enoch Mgijima LM')).toBeVisible({ timeout: 15_000 });
  });
});
