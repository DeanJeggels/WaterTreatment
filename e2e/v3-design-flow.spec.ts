import { test, expect } from '@playwright/test';

/**
 * Full guided-design flow. Runs ONLY when E2E_EMAIL / E2E_PASSWORD are set
 * (the routes are Supabase-auth-gated). Exercises: login → new guided project →
 * Design tab → wizard → generate → 2D layout + compliance verdict render.
 */
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe('AquaSim v3 guided design (authenticated)', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL / E2E_PASSWORD to run the authenticated flow');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/\/dashboard|\/project/);
  });

  test('Design tab is visible alongside Flowsheet and Proposal', async ({ page }) => {
    await page.goto('/project/new');
    await page.getByLabel(/project name/i).fill('E2E MLE Plant');
    await page.getByRole('button', { name: /guided design/i }).click();
    await page.getByRole('button', { name: /create project/i }).click();
    await page.waitForURL(/\/design\//);
    await expect(page.getByRole('link', { name: /flowsheet/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /proposal/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /design/i })).toBeVisible();
  });

  test('wizard cross-field validation blocks an impossible input', async ({ page }) => {
    await page.goto('/project/new');
    await page.getByLabel(/project name/i).fill('E2E Validation');
    await page.getByRole('button', { name: /guided design/i }).click();
    await page.getByRole('button', { name: /create project/i }).click();
    await page.waitForURL(/\/design\//);

    // Step 2: make NH3-N exceed TKN -> cross-field error.
    await page.getByRole('button', { name: /influent quality/i }).click();
    await page.getByLabel(/NH₃-N|NH3-N/i).fill('999');
    await page.getByRole('button', { name: /review/i }).click();
    await expect(page.getByText(/cannot exceed TKN/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /generate design/i })).toBeDisabled();
  });

  test('generates a design with a 2D layout and compliance verdict', async ({ page }) => {
    await page.goto('/project/new');
    await page.getByLabel(/project name/i).fill('E2E Komani');
    await page.getByRole('button', { name: /guided design/i }).click();
    await page.getByRole('button', { name: /create project/i }).click();
    await page.waitForURL(/\/design\//);

    // Defaults are valid; step to Review and generate.
    await page.getByRole('button', { name: /review/i }).click();
    await page.getByRole('button', { name: /generate design/i }).click();

    await expect(page.getByRole('img', { name: /plant layout/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /compliance/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /JSON/i })).toBeVisible();
  });

  test('client name entered in the wizard carries over to the Proposal tab', async ({ page }) => {
    await page.goto('/project/new');
    await page.getByLabel(/project name/i).fill('E2E Carryover');
    await page.getByRole('button', { name: /guided design/i }).click();
    await page.getByRole('button', { name: /create project/i }).click();
    await page.waitForURL(/\/design\//);

    await page.getByLabel(/^client/i).fill('Enoch Mgijima LM');
    await page.getByRole('button', { name: /review/i }).click();
    await page.getByRole('button', { name: /generate design/i }).click();
    await expect(page.getByRole('img', { name: /plant layout/i })).toBeVisible({ timeout: 20_000 });

    // Navigate to the Proposal tab — the client name must already be there.
    await page.getByRole('link', { name: /proposal/i }).click();
    await page.waitForURL(/\/proposal\//);
    await expect(page.getByText('Enoch Mgijima LM')).toBeVisible({ timeout: 15_000 });
  });
});
