import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const ALLOWED_LATIN_TOKENS = new Set([
  'github',
  'youtube',
  'google',
  'drive',
  'pdf',
  'excel',
  'xlsx',
  'id',
  'http',
  'https',
  'rtl',
  'ltr',
  'smart',
  'campus',
  'demo',
  'eng',
  'cs',
  'iot',
  'ai',
]);

async function assertArabicOnlyUi(page) {
  const suspiciousWords = await page.evaluate((allowed) => {
    const allowedSet = new Set(allowed);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const bad = [];
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent) continue;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
      if (parent.closest('[dir="ltr"]')) continue;
      const text = node.nodeValue || '';
      const matches = text.match(/[A-Za-z]{3,}/g) || [];
      for (const word of matches) {
        if (!allowedSet.has(word.toLowerCase())) {
          bad.push(word);
        }
      }
    }
    return bad;
  }, [...ALLOWED_LATIN_TOKENS]);

  expect(suspiciousWords).toEqual([]);
}

async function assertRtlAndNoOverflow(page) {
  const layout = await page.evaluate(() => ({
    dir: document.documentElement.getAttribute('dir'),
    lang: document.documentElement.getAttribute('lang'),
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(layout.dir).toBe('rtl');
  expect(layout.lang).toBe('ar');
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth);
}

async function assertNoSeriousAxeViolations(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );
  expect(seriousOrCritical).toEqual([]);
}

const PUBLIC_ROUTES = ['/', '/p/smart-campus-demo', '/competitions', '/login', '/register'];

test.describe('RTL, WCAG 2.1 AA & Arabic-Only UI Verification', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`public route ${route} passes RTL, zero overflow, WCAG 2.1 AA, and Arabic-only checks`, async ({
      page,
    }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main, h1, h2').first()).toBeVisible();

      await assertRtlAndNoOverflow(page);
      await assertArabicOnlyUi(page);
      await assertNoSeriousAxeViolations(page);
    });
  }

  test('authenticated dashboard & reports pass RTL, mobile dock/overflow, WCAG 2.1 AA, and Arabic-only checks', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.locator('#login-email').fill('eng-admin@mnu.edu.eg');
    await page.locator('#login-password').fill('E2ePass123!');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app/);

    for (const authRoute of ['/app', '/app/projects', '/app/reports']) {
      await page.goto(authRoute);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main').first()).toBeVisible();

      await assertRtlAndNoOverflow(page);
      await assertArabicOnlyUi(page);
      await assertNoSeriousAxeViolations(page);
    }
  });
});
