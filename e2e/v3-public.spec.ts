import { test, expect } from '@playwright/test';

/**
 * Auth-free smoke tests for the v3 surfaces. The /project/** routes are
 * middleware-gated, so without a session they must redirect to /login — which
 * proves both the route is wired and the guard is intact.
 */
test.describe('AquaSim v3 public surfaces', () => {
  test('home page loads with AquaSim branding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AquaSim|Aqua/i);
  });

  test('the Design route redirects an unauthenticated user to /login', async ({ page }) => {
    await page.goto('/project/00000000-0000-0000-0000-000000000000/design/00000000-0000-0000-0000-000000000001');
    await expect(page).toHaveURL(/\/login/);
  });

  test('the new-project route is auth-gated too', async ({ page }) => {
    await page.goto('/project/new');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page renders a sign-in form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('textbox', { name: /email/i }).or(page.locator('input[type="email"]'))).toBeVisible();
  });
});
