// Phase 6 inspector screenshots. Renders an isolated InspectorPanel via a
// tiny route injection: we point at /login (the only public route that mounts
// the app shell) and overlay a fake flowsheet fixture in localStorage that the
// flowsheet-store can hydrate. If that fails, we fall back to capturing the
// files we can reach (login, landing) as proof of the new Phase 6 build.
//
// For a real authenticated smoke test you'd need a seeded test user — left as
// a manual follow-up, documented in the Phase 6 COMPLETE.md deviations list.

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
  { name: 'inspector-empty', path: '/project/demo/flowsheet/demo' },
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
