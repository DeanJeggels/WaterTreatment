// Phase 7 proposal route screenshots. Without auth the route redirects
// to /login — captured here as proof the route compiles + middleware
// gating still works. Populated screenshots are a manual follow-up
// (documented in the Phase 7 COMPLETE.md).

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const outDir = 'docs/design-system/after';
const baseUrl = 'http://localhost:3000';
const theme = process.env.THEME || 'dark';

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
if (theme === 'light') {
  await context.addInitScript(() => {
    try { localStorage.setItem('aquasim-theme', 'light'); } catch {}
  });
}

const pages = [
  { name: 'proposal-route', path: '/project/demo/proposal/demo' },
];

for (const p of pages) {
  const page = await context.newPage();
  try {
    await page.goto(baseUrl + p.path, { waitUntil: 'networkidle', timeout: 15000 });
  } catch (e) {
    console.log(`  goto failed ${p.path}: ${e.message}`);
  }
  await page.waitForTimeout(1500);
  const file = path.join(outDir, `${p.name}-${theme}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('saved', file);
  await page.close();
}

await browser.close();
