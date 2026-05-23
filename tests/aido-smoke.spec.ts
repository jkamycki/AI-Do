import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const authStatePath = path.join(process.cwd(), '.auth', 'user.json');
const hasAuthState = fs.existsSync(authStatePath);

const publicRoutes = [
  { path: '/terms', label: 'Terms' },
  { path: '/privacy', label: 'Privacy' },
  { path: '/security', label: 'Security' },
  { path: '/data-handling', label: 'Data handling' },
  { path: '/help/updates-improvements', label: 'Updates' },
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

test.describe('authenticated app smoke test', () => {
  test.setTimeout(60_000);
  test.use({ storageState: hasAuthState ? authStatePath : undefined });

  test.beforeEach(() => {
    test.skip(
      !hasAuthState,
      'Missing .auth/user.json. Run: npx.cmd playwright codegen --save-storage=.auth/user.json https://aidowedding.net',
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
