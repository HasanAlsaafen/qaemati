// Phase 7 audit tool: runs axe-core against key pages (public + admin,
// logged in), both locales, and prints a compact summary of violations.
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');

const BASE = 'http://localhost:3000';

const PAGES = [
  { name: 'menu-ar', url: `${BASE}/m/bayt-al-zaytoun?lang=ar` },
  { name: 'menu-en', url: `${BASE}/m/bayt-al-zaytoun?lang=en` },
  { name: 'admin-login-ar', url: `${BASE}/admin/login?lang=ar` },
  { name: 'admin-login-en', url: `${BASE}/admin/login?lang=en` },
];
const ADMIN_PAGES = [
  { name: 'admin-dashboard-ar', url: `${BASE}/admin?lang=ar` },
  { name: 'admin-dashboard-en', url: `${BASE}/admin?lang=en` },
  { name: 'admin-qr-ar', url: `${BASE}/admin/qr?lang=ar` },
  { name: 'admin-qr-en', url: `${BASE}/admin/qr?lang=en` },
];

async function loginAdmin(page) {
  await page.goto(`${BASE}/admin/login`);
  await page.fill('input[name="email"]', 'admin@baytalzaytoun.example.com');
  await page.fill('input[name="password"]', 'Qaemati@Demo123');
  await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]')]);
}

async function run(page, name, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  console.log(`\n=== ${name} (${url}) ===`);
  console.log(`violations: ${results.violations.length}`);
  for (const v of results.violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
    for (const n of v.nodes.slice(0, 3)) {
      console.log(`     - ${n.target.join(' ')}`);
    }
  }
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  for (const p of PAGES) {
    const page = await context.newPage();
    await run(page, p.name, p.url);
    await page.close();
  }

  const adminPage = await context.newPage();
  await loginAdmin(adminPage);
  for (const p of ADMIN_PAGES) {
    const page = await context.newPage();
    // share cookies via context
    await run(page, p.name, p.url);
    await page.close();
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
