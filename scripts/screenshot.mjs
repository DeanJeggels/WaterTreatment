import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2] || 'docs/design-system/before';
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const theme = process.env.THEME || 'dark';

const pages = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'dashboard', path: '/dashboard' },
  { name: 'project-editor', path: '/project/new' },
];

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

for (const p of pages) {
  const page = await context.newPage();
  const url = baseUrl + p.path;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  } catch (e) {
    console.log(`goto timeout/failed for ${url}: ${e.message}`);
  }
  await page.waitForTimeout(1500);
  const file = path.join(outDir, `${p.name}-${theme}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('saved', file);
  await page.close();
}

await browser.close();
