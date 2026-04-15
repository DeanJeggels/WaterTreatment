import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const outPath = process.argv[2];
if (!outPath) {
  console.error('Usage: node scripts/landing-screenshot.mjs <output-path>');
  process.exit(1);
}

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const theme = process.env.THEME || 'dark';

await mkdir('docs/design-system', { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

// Landing page has no theme toggle — force via class before first paint
if (theme === 'light') {
  await context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.classList.remove('dark');
    });
  });
}

const page = await context.newPage();
await page.goto(baseUrl + '/', { waitUntil: 'networkidle', timeout: 15000 });

if (theme === 'light') {
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
}

await page.waitForTimeout(1000);
await page.screenshot({ path: outPath, fullPage: true });
console.log('saved', outPath);

await browser.close();
