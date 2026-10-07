// Re-runnable check for the admin mobile and accessibility work: for each
// page and language it runs axe (WCAG 2 A, AA, 2.2 AA) at 375px and reports
// serious violations, horizontal overflow and interactive controls smaller
// than 44px. Usage: node scripts/admin-mobile-check.js [baseUrl] [--verbose]
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');

const BASE = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:3000';
const VERBOSE = process.argv.includes('--verbose');
const EMAIL = process.env.ADMIN_EMAIL || 'admin@baytalzaytoun.example.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Qaemati@Demo123';

const PUBLIC = [
  ['home', '/?lang=en'],
  ['home-ar', '/?lang=ar'],
  ['404', '/nope?lang=en'],
  ['404-ar', '/nope?lang=ar'],
  ['offline', '/offline?lang=en'],
  ['menu-en', '/m/al-sanabel?lang=en'],
  ['menu-ar', '/m/al-sanabel?lang=ar'],
  ['login', '/admin/login?lang=en'],
];
const SUPER_EMAIL = process.env.SUPER_EMAIL || 'super@qaemati.example.com';
const SUPER = [
  ['super-dash', '/super?lang=en'],
  ['super-dash-ar', '/super?lang=ar'],
  ['super-tenants', '/super/restaurants?lang=en'],
  ['super-new', '/super/restaurants/new?lang=en'],
  ['super-plans', '/super/plans?lang=en'],
  ['super-plan-new', '/super/plans/new?lang=en'],
  ['super-payments', '/super/payments?lang=en'],
  ['super-pay-new', '/super/payments/new?lang=en'],
  ['super-audit', '/super/audit?lang=en'],
  ['super-security', '/super/security?lang=en'],
  ['super-security-ar', '/super/security?lang=ar'],
  ['super-2fa-setup', '/super/security/setup?lang=en'],
  ['super-forgot', '/super/forgot?lang=en'],
];
const ADMIN = [
  ['dash', '/admin?lang=en'],
  ['dash-ar', '/admin?lang=ar'],
  ['branding', '/admin/branding?lang=en'],
  ['branding-ar', '/admin/branding?lang=ar'],
  ['bulk', '/admin/bulk?lang=en'],
  ['bulk-ar', '/admin/bulk?lang=ar'],
  ['analytics', '/admin/analytics?lang=en'],
  ['qr', '/admin/qr?lang=en'],
  ['qr-print', '/admin/qr/print?lang=en'],
  ['landing', '/?lang=en'],
  ['landing-ar', '/?lang=ar'],
  ['forgot', '/admin/forgot?lang=en'],
  ['forgot-ar', '/admin/forgot?lang=ar'],
  ['reset-invalid', `/admin/reset/${'a'.repeat(64)}?lang=en`],
  ['billing', '/admin/billing?lang=en'],
  ['billing-ar', '/admin/billing?lang=ar'],
];

async function measure(page, name, url) {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('a[href],button,input,select,textarea,summary,[role=button]')]
      .filter((el) => {
        if (el.type === 'hidden' || el.disabled) return false;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        let rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        // Visually hidden native inputs behind a custom control are not targets.
        if (rect.width <= 1 && rect.height <= 1) return false;
        // A checkbox or radio is activated through its label, so the label is the target.
        if (el.type === 'checkbox' || el.type === 'radio') {
          const label = el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`));
          if (label) rect = label.getBoundingClientRect();
        }
        return rect.height < 44 || rect.width < 44;
      })
      .map((el) => `${el.tagName.toLowerCase()} ${(el.getAttribute('aria-label') || el.textContent || el.name || '').trim().slice(0, 24)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`),
  );
  const violations = axe.violations.map((v) => `${v.id}[${v.impact}]:${v.nodes.length}`).join(' ') || 'none';
  const hscroll = overflow.scroll > overflow.client ? `YES ${overflow.scroll}px` : 'no';
  console.log(`${name.padEnd(12)} axe: ${violations} | hscroll: ${hscroll} | small targets: ${small.length}`);
  if (VERBOSE && small.length) {
    const counts = {};
    small.forEach((s) => (counts[s] = (counts[s] || 0) + 1));
    Object.entries(counts).forEach(([k, v]) => console.log(`      ${v} x ${k}`));
  }
  return { violations: axe.violations, small: small.length, hscroll: overflow.scroll > overflow.client };
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await context.newPage();
  const totals = { nodes: 0, serious: 0, small: 0, hscroll: 0 };
  const add = (r) => {
    r.violations.forEach((v) => {
      totals.nodes += v.nodes.length;
      if (v.impact === 'serious' || v.impact === 'critical') totals.serious += v.nodes.length;
    });
    totals.small += r.small;
    totals.hscroll += r.hscroll ? 1 : 0;
  };
  for (const [name, url] of PUBLIC) add(await measure(page, name, url));
  await page.goto(`${BASE}/admin/login`);
  await page.fill('input[name=email]', EMAIL);
  await page.fill('input[name=password]', PASSWORD);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
  for (const [name, url] of ADMIN) add(await measure(page, name, url));
  // Super admin pages, with the restaurant detail and a receipt found from the list.
  const superContext = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const superPage = await superContext.newPage();
  await superPage.goto(`${BASE}/super/login`);
  await superPage.fill('input[name=email]', SUPER_EMAIL);
  await superPage.fill('input[name=password]', PASSWORD);
  await Promise.all([superPage.waitForNavigation(), superPage.click('button[type=submit]')]);
  const detailHref = await superPage.goto(`${BASE}/super/restaurants?lang=en`).then(() =>
    superPage.getAttribute('main ul li a[href^="/super/restaurants/"]', 'href'),
  );
  const receiptHref = await superPage.goto(`${BASE}/super/payments?lang=en`).then(() =>
    superPage.getAttribute('a[href$="/receipt"]', 'href').catch(() => null),
  );
  const extra = [];
  if (detailHref) extra.push(['super-tenant', `${detailHref}?lang=en`], ['super-tenant-ar', `${detailHref}?lang=ar`]);
  if (receiptHref) extra.push(['super-receipt', `${receiptHref}?lang=en`]);
  for (const [name, url] of [...SUPER, ...extra]) add(await measure(superPage, name, url));
  console.log(`\nTOTAL axe nodes: ${totals.nodes} (serious or critical: ${totals.serious}) | pages with horizontal scroll: ${totals.hscroll} | small targets: ${totals.small}`);
  await browser.close();
})();
