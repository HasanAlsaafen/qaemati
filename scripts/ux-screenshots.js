// One-off Phase 7 audit tool, not part of the app build. Captures a
// representative screenshot matrix (public + admin, AR/EN, 4 viewports, a
// few key states) into docs/ux/screenshots/<before|after>/.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT_DIR = process.argv[2] || 'docs/ux/screenshots/before';
const VIEWPORTS = [
  { name: '360', width: 360, height: 740 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 900 },
];
const LOCALES = ['ar', 'en'];

async function shot(page, outPath, fullPage = true) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath, fullPage });
  console.log('saved', outPath);
}

async function loginAdmin(page) {
  await page.goto(`${BASE}/admin/login`);
  await page.fill('#email, input[name="email"]', 'admin@baytalzaytoun.example.com');
  await page.fill('#password, input[name="password"]', 'Qaemati@Demo123');
  await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]')]);
}

let browser;
let context;
let page;

// A fresh page per shot avoids renderer memory buildup across many
// navigations in this memory-constrained environment (observed consistent
// "Page crashed" after ~9 reused-page navigations).
async function freshPage() {
  if (page) await page.close().catch(() => {});
  if (!context) context = await browser.newContext();
  page = await context.newPage();
  return page;
}

async function main() {
  browser = await chromium.launch();
  context = await browser.newContext();

  // --- Public menu + home, every viewport x locale ---
  for (const vp of VIEWPORTS) {
    for (const locale of LOCALES) {
      await freshPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE}/m/bayt-al-zaytoun?lang=${locale}`, { waitUntil: 'networkidle' });
      await shot(page, path.join(OUT_DIR, `menu-${locale}-${vp.name}.png`));
    }
  }

  // --- Public menu: empty search state (one representative viewport) ---
  for (const locale of LOCALES) {
    await freshPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/m/bayt-al-zaytoun?lang=${locale}`, { waitUntil: 'networkidle' });
    await page.fill('[data-menu-search]', 'zzzznotfound');
    await page.waitForTimeout(200);
    await shot(page, path.join(OUT_DIR, `menu-empty-search-${locale}-390.png`), false);
  }

  // --- Public menu: item detail sheet open ---
  for (const locale of LOCALES) {
    await freshPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/m/bayt-al-zaytoun?lang=${locale}`, { waitUntil: 'networkidle' });
    await page.click('[data-menu-sections] button, [data-menu-sections] [role="button"], [data-menu-sections] a, [data-menu-sections] div[class*="cursor-pointer"]').catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, path.join(OUT_DIR, `menu-item-sheet-${locale}-390.png`), false);
  }

  // --- 404 page ---
  for (const locale of LOCALES) {
    await freshPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/m/not-a-real-restaurant?lang=${locale}`, { waitUntil: 'networkidle' });
    await shot(page, path.join(OUT_DIR, `menu-404-${locale}-390.png`), false);
  }

  // --- Admin login ---
  for (const vp of [VIEWPORTS[1], VIEWPORTS[3]]) {
    for (const locale of LOCALES) {
      await freshPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE}/admin/login?lang=${locale}`, { waitUntil: 'networkidle' });
      await shot(page, path.join(OUT_DIR, `admin-login-${locale}-${vp.name}.png`), false);
    }
  }

  // --- Admin login: invalid credentials error state ---
  for (const locale of LOCALES) {
    await freshPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/admin/login?lang=${locale}`, { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', 'admin@baytalzaytoun.example.com');
    await page.fill('input[name="password"]', 'wrong-password');
    await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]')]);
    await shot(page, path.join(OUT_DIR, `admin-login-error-${locale}-390.png`), false);
  }

  // --- Admin: logged in, dashboard/categories, every viewport x locale ---
  await freshPage();
  await loginAdmin(page);
  for (const vp of VIEWPORTS) {
    for (const locale of LOCALES) {
      await freshPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE}/admin?lang=${locale}`, { waitUntil: 'networkidle' });
      await shot(page, path.join(OUT_DIR, `admin-dashboard-${locale}-${vp.name}.png`));
    }
  }

  // --- Admin: category edit mode open (one viewport) ---
  for (const locale of LOCALES) {
    await freshPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/admin?lang=${locale}`, { waitUntil: 'networkidle' });
    const editButtons = await page.$$('button[x-on\\:click="editing = true"]');
    if (editButtons.length) {
      await editButtons[0].click();
      await page.waitForTimeout(150);
    }
    await shot(page, path.join(OUT_DIR, `admin-category-edit-${locale}-390.png`), false);
  }

  // --- Admin QR page, with and without tables (empty state) ---
  for (const locale of LOCALES) {
    for (const vp of [VIEWPORTS[1], VIEWPORTS[3]]) {
      await freshPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE}/admin/qr?lang=${locale}`, { waitUntil: 'networkidle' });
      await shot(page, path.join(OUT_DIR, `admin-qr-${locale}-${vp.name}.png`));
    }
  }

  // --- Admin QR print page ---
  for (const locale of LOCALES) {
    await freshPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}/admin/qr/print?lang=${locale}`, { waitUntil: 'networkidle' });
    await shot(page, path.join(OUT_DIR, `admin-qr-print-${locale}-1280.png`));
  }

  // --- Admin: delete confirm dialog open ---
  for (const locale of LOCALES) {
    await freshPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/admin?lang=${locale}`, { waitUntil: 'networkidle' });
    const delButtons = await page.$$('button[aria-label]');
    let clicked = false;
    for (const btn of delButtons) {
      const label = await btn.getAttribute('aria-label');
      if (label && /delete|حذف/i.test(label)) {
        await btn.click();
        clicked = true;
        break;
      }
    }
    if (clicked) await page.waitForTimeout(200);
    await shot(page, path.join(OUT_DIR, `admin-confirm-dialog-${locale}-390.png`), false);
  }

  await browser.close();
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
