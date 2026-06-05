import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const authStatePath = path.join(process.cwd(), '.auth', 'user.json');
const hasAuthState = fs.existsSync(authStatePath);
const baseURL = process.env.AIDO_BASE_URL ?? 'http://localhost:5173';

function authStateMatchesBaseUrl() {
  if (!hasAuthState) return false;

  const host = new URL(baseURL).hostname;
  if (host === 'localhost' || host === '127.0.0.1') return true;

  const authState = JSON.parse(fs.readFileSync(authStatePath, 'utf8')) as {
    cookies?: Array<{ domain?: string }>;
    origins?: Array<{ origin?: string }>;
  };
  return Boolean(
    authState.cookies?.some((cookie) => cookie.domain?.replace(/^\./, '') === host) ||
      authState.origins?.some((origin) => {
        try {
          return new URL(origin.origin ?? '').hostname === host;
        } catch {
          return false;
        }
      }),
  );
}

const hasUsableAuthState = authStateMatchesBaseUrl();

const publicRoutes = [
  { path: '/terms', label: 'Terms' },
  { path: '/privacy', label: 'Privacy' },
  { path: '/security', label: 'Security' },
  { path: '/data-handling', label: 'Data handling' },
  { path: '/help/updates-improvements', label: 'Updates' },
];

const mobileMarketingRoutes = [
  { path: '/', label: 'Landing', expected: /calmer way to plan your wedding|join free beta/i },
  { path: '/ai-wedding-planner', label: 'AI wedding planner', expected: /ai wedding planner|plan your wedding faster/i },
  { path: '/wedding-website-builder', label: 'Wedding website builder', expected: /create a wedding website/i },
  { path: '/wedding-photo-qr-code', label: 'Wedding photo QR code', expected: /collect wedding guest photos/i },
  { path: '/digital-invitations', label: 'Digital invitations', expected: /send digital invitations/i },
  { path: '/wedding-guest-list-manager', label: 'Guest list manager', expected: /organize your guest list/i },
  { path: '/for-vendors', label: 'Vendor landing', expected: /become a founding a\.i do vendor/i },
  { path: '/for-vendors/apply', label: 'Vendor application', expected: /apply as a founding vendor/i },
];

const appRoutes = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/budget/summary', label: 'Budget Summary' },
  { path: '/budget', label: 'Budget' },
  { path: '/vendors', label: 'Vendors' },
  { path: '/guests', label: 'Guest List' },
  { path: '/timeline', label: 'Timeline' },
  { path: '/checklist', label: 'Checklist' },
  { path: '/hotels', label: 'Hotels' },
  { path: '/contracts', label: 'Contracts' },
  { path: '/documents', label: 'Documents' },
  { path: '/wedding-party', label: 'Wedding Party' },
  { path: '/website-editor', label: 'Website Editor' },
  { path: '/operations-center', label: 'Operations Center' },
];

const mobileAppRoutes = [
  { path: '/dashboard', label: 'Dashboard', expected: /dashboard|wedding|budget|guest|vendor|plan on the go/i },
  { path: '/website-editor', label: 'Website Editor', expected: /website|publish|preview|rsvp|photo/i },
  { path: '/guests', label: 'Guest List & Invitations', expected: /guest|rsvp|save the date|invitation/i },
  { path: '/guest-photo-drop', label: 'Guest Photo Drop', expected: /photo drop|qr|upload|approval|gallery/i },
  { path: '/vendors', label: 'Vendor Hub', expected: /vendor|message|contact|payment|contract/i },
  { path: '/budget', label: 'Budget', expected: /budget|vendor expenses|payment|remaining/i },
  { path: '/calendar', label: 'Calendar', expected: /calendar|payment|task|hotel|deadline/i },
  { path: '/checklist', label: 'Checklist', expected: /checklist|task|deadline|reminder/i },
  { path: '/contracts', label: 'Contracts', expected: /contract|analyze|upload|vendor|hotel/i },
  { path: '/documents', label: 'Documents', expected: /document|upload|download|folder|contract/i },
  { path: '/seating-chart', label: 'Seating Chart', expected: /seating|table|guest/i },
  { path: '/day-of', label: 'Day Of', expected: /day-of|timeline|emergency|vendor|photo|binder/i },
  { path: '/aria', label: 'Aria', expected: /aria|assistant|ask|message/i },
];

function collectPageFailures(page: Page) {
  const failures: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource/i.test(message.text())) {
      failures.push(`console error: ${message.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    failures.push(`page error: ${error.message}`);
  });

  return failures;
}

async function expectHealthyPage(page: Page, label: string, failures: string[]) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(750);

  await expect(page.locator('body')).not.toContainText(/we'?re working on it/i);
  await expect(page.locator('body')).not.toContainText(/something went wrong/i);
  await expect(page.locator('body')).not.toContainText(/internal server error/i);

  const brokenImages = await page.evaluate(() =>
    Array.from(document.images)
      .filter((image) => image.currentSrc && image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc),
  );

  expect(brokenImages, `${label} has broken images`).toEqual([]);
  expect(failures, `${label} browser errors`).toEqual([]);
}

async function expectNoPageHorizontalOverflow(page: Page, label: string) {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  const widest = Math.max(dimensions.documentWidth, dimensions.bodyWidth);
  expect(
    widest,
    `${label} should not create page-level horizontal scrolling on a narrow phone viewport`,
  ).toBeLessThanOrEqual(dimensions.viewportWidth + 2);
}

async function expectVisiblePageText(page: Page, label: string, expected: RegExp) {
  await expect
    .poll(
      async () => {
        const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
        return expected.test(text);
      },
      { message: `${label} visible page content`, timeout: 25_000 },
    )
    .toBe(true);
}

test.describe('public pages', () => {
  test.setTimeout(60_000);

  for (const route of publicRoutes) {
    test(`${route.label} loads cleanly`, async ({ page }) => {
      const failures = collectPageFailures(page);
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await expectHealthyPage(page, route.label, failures);
    });
  }
});

test.describe('mobile marketing pages', () => {
  test.setTimeout(60_000);

  for (const route of mobileMarketingRoutes) {
    test(`${route.label} is narrow-phone friendly`, async ({ page }) => {
      const failures = collectPageFailures(page);
      await page.setViewportSize({ width: 320, height: 740 });
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      expect(response?.ok(), `${route.label} HTTP response`).toBeTruthy();
      await expect(page.locator('main')).toContainText(route.expected, { timeout: 10_000 });
      await expectHealthyPage(page, route.label, failures);
      await expectNoPageHorizontalOverflow(page, route.label);
    });
  }
});

test.describe('authenticated app smoke test', () => {
  test.setTimeout(60_000);
  test.use({ storageState: hasUsableAuthState ? authStatePath : undefined });

  test.beforeEach(() => {
    test.skip(
      !hasUsableAuthState,
      `Missing usable .auth/user.json for ${baseURL}. Run: npx.cmd playwright codegen --save-storage=.auth/user.json ${baseURL}`,
    );
  });

  for (const route of appRoutes) {
    test(`${route.label} loads cleanly`, async ({ page }) => {
      const failures = collectPageFailures(page);
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      expect(response?.ok(), `${route.label} HTTP response`).toBeTruthy();
      await expect(page).not.toHaveURL(/sign-in/i);
      await expectHealthyPage(page, route.label, failures);
    });
  }
});

test.describe('mobile authenticated app smoke test', () => {
  test.setTimeout(90_000);
  test.use({ storageState: hasUsableAuthState ? authStatePath : undefined });

  test.beforeEach(() => {
    test.skip(
      !hasUsableAuthState,
      `Missing usable .auth/user.json for ${baseURL}. Run: npx.cmd playwright codegen --save-storage=.auth/user.json ${baseURL}`,
    );
  });

  for (const route of mobileAppRoutes) {
    test(`${route.label} is phone friendly`, async ({ page }) => {
      const failures = collectPageFailures(page);
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      expect(response?.ok(), `${route.label} HTTP response`).toBeTruthy();
      await expect(page).not.toHaveURL(/sign-in/i);
      await expectVisiblePageText(page, route.label, route.expected);
      await expectHealthyPage(page, route.label, failures);
      await expectNoPageHorizontalOverflow(page, route.label);
    });
  }
});
