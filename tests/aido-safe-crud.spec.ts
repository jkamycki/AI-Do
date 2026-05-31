import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const authStatePath = path.join(process.cwd(), '.auth', 'user.json');
const hasAuthState = fs.existsSync(authStatePath);

function stamp(testName: string, projectName: string) {
  return `${testName} ${projectName.replace(/\W+/g, '-')}-${Date.now()}`;
}

async function visible(locator: Locator, timeout = 1500) {
  return locator.first().isVisible({ timeout }).catch(() => false);
}

async function expectVisibleMainContent(page: Page, expected: RegExp) {
  await expect
    .poll(
      async () => {
        const candidates = page.locator('main, [role="main"]').filter({ hasText: expected });
        const count = await candidates.count().catch(() => 0);
        for (let index = 0; index < count; index += 1) {
          if (await visible(candidates.nth(index))) return true;
        }
        return false;
      },
      { message: 'Expected signed-in page content', timeout: 25_000 },
    )
    .toBe(true);
}

async function expectAppReady(page: Page, expected: RegExp) {
  await expectVisibleMainContent(page, expected);
  await expect(page).not.toHaveURL(/sign-in|sign-up/i);
  await expect(page.locator('body')).not.toContainText(/we'?re working on it|something went wrong|internal server error|unauthorized/i);
}

async function gotoApp(page: Page, url: string, expected: RegExp) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), `${url} response`).toBeTruthy();
  await expectAppReady(page, expected);
}

async function firstVisibleLocator(locators: Locator[]) {
  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await visible(candidate)) return candidate;
    }
  }
  return null;
}

async function fillMoneyInput(container: Locator, index: number, value: string) {
  const moneyInputs = container.locator('input[inputmode="decimal"]');
  await expect(moneyInputs.nth(index)).toBeVisible();
  await moneyInputs.nth(index).fill(value);
}

async function selectOption(page: Page, trigger: Locator, optionName: RegExp) {
  await trigger.click();
  await page.getByRole('option', { name: optionName }).click();
}

async function deleteVendorIfPresent(page: Page, vendorName: string) {
  await gotoApp(page, '/vendors', /vendor/i);
  const vendorCard = page.locator('[data-testid^="vendor-card-"]').filter({ hasText: vendorName }).first();
  if (!(await visible(vendorCard, 2500))) return;

  await vendorCard.getByLabel(/delete vendor/i).click();
  await page.getByTestId('btn-confirm-delete-vendor').click();
  await expect(page.locator('body')).not.toContainText(vendorName, { timeout: 12_000 });
}

async function deleteGuestIfPresent(page: Page, guestName: string) {
  await gotoApp(page, '/guests', /guest/i);
  let guestItem = page.getByRole('row').filter({ hasText: guestName }).first();
  if (!(await visible(guestItem, 2500))) {
    guestItem = page.locator('article, li, .rounded-xl, .rounded-2xl').filter({ hasText: guestName }).first();
  }
  if (!(await visible(guestItem, 2500))) return;

  await guestItem.locator('button').last().click();
  await page.getByRole('button', { name: /^remove$/i }).click();
  await expect(page.locator('body')).not.toContainText(guestName, { timeout: 12_000 });
}

async function deleteStalePlaywrightGuests(page: Page) {
  await gotoApp(page, '/guests', /guest/i);
  await page.evaluate(async () => {
    const clerk = (window as unknown as { Clerk?: { session?: { getToken?: () => Promise<string | null> } } }).Clerk;
    const token = await clerk?.session?.getToken?.();
    if (!token) throw new Error('Missing Clerk token for guest cleanup');

    const listResponse = await fetch('/api/guests', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listResponse.ok) throw new Error(`Guest cleanup list failed: ${listResponse.status}`);

    const data = (await listResponse.json()) as { guests?: Array<{ id: number; name?: string | null }> };
    const staleGuests = (data.guests ?? []).filter((guest) => guest.name?.startsWith('Playwright Guest'));

    await Promise.all(
      staleGuests.map((guest) =>
        fetch(`/api/guests/${guest.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }),
      ),
    );
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expectAppReady(page, /guest/i);
}

async function deleteHotelIfPresent(page: Page, hotelName: string) {
  await gotoApp(page, '/hotels', /hotel/i);
  const hotelNameText = page.getByText(hotelName).first();
  if (!(await visible(hotelNameText, 2500))) return;

  const hotelCard = hotelNameText.locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
  await hotelCard.locator('button').nth(1).click();
  await page.getByRole('button', { name: /^remove$/i }).click();
  await expect(page.locator('body')).not.toContainText(hotelName, { timeout: 12_000 });
}

test.describe('A.IDO safe CRUD workflows', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90_000);
  test.use({ storageState: hasAuthState ? authStatePath : undefined });

  test.beforeEach(({}, testInfo) => {
    test.skip(
      !hasAuthState,
      'Missing .auth/user.json. Run: npx.cmd playwright codegen --save-storage=.auth/user.json https://aidowedding.net',
    );
    test.skip(
      testInfo.project.name !== 'chromium',
      'Safe CRUD mutates the shared test account, so full-suite runs keep it to one browser project.',
    );
  });

  test('creates, verifies, and deletes a vendor from Vendor Tracking', async ({ page }, testInfo) => {
    const vendorName = stamp('Playwright Vendor', testInfo.project.name);

    try {
      await deleteVendorIfPresent(page, vendorName);
      await gotoApp(page, '/vendors', /vendor/i);

      const addVendor = await firstVisibleLocator([
        page.getByTestId('btn-add-vendor'),
        page.getByTestId('btn-add-first-vendor'),
        page.getByTestId('btn-add-vendor-card'),
        page.locator('main').getByRole('button', { name: /add vendor|add first vendor/i }),
        page.locator('main').locator('button').filter({ hasText: /add vendor|add first vendor/i }),
      ]);
      expect(addVendor, 'Add vendor button').not.toBeNull();
      await addVendor?.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(/add vendor/i);
      await page.getByTestId('input-vendor-name').fill(vendorName);
      await selectOption(page, page.getByTestId('select-vendor-category'), /photographer/i);
      await dialog.locator('input[type="email"]').fill(`playwright-${Date.now()}@example.com`);
      await fillMoneyInput(dialog, 0, '1234');
      await fillMoneyInput(dialog, 1, '234');
      await page.getByTestId('btn-save-vendor').click();

      await expect(page.locator('body')).toContainText(vendorName, { timeout: 15_000 });
      await expect(page.locator('[data-testid^="vendor-card-"]').filter({ hasText: vendorName })).toBeVisible();
    } finally {
      await deleteVendorIfPresent(page, vendorName).catch(() => {});
    }
  });

  test('creates, verifies, and deletes a guest with a plus-one', async ({ page }, testInfo) => {
    const guestName = stamp('Playwright Guest', testInfo.project.name);
    const email = `playwright-guest-${Date.now()}@example.com`;

    try {
      await deleteStalePlaywrightGuests(page);

      await page.getByRole('button', { name: /add guest/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(/new guest|add guest/i);
      await dialog.getByPlaceholder(/jane smith/i).fill(guestName);
      await dialog.getByPlaceholder(/jane@example\.com/i).fill(email);
      await dialog.getByRole('switch').first().click();
      await dialog.getByPlaceholder(/^Alex$/i).fill('Playwright');
      await dialog.getByPlaceholder(/^Smith$/i).fill('Plusone');
      await dialog.getByRole('button', { name: /^add guest$/i }).click();

      await expect(page.locator('body')).toContainText(guestName, { timeout: 15_000 });
      await expect(page.locator('body')).toContainText(/Playwright Plusone/i);

      const tableInput = page.getByLabel(`Table assignment for ${guestName}`);
      await expect(tableInput).toBeVisible();
      const tableUpdate = page.waitForResponse((response) => (
        response.url().includes('/api/guests/') &&
        response.request().method() === 'PUT' &&
        response.ok()
      ));
      await tableInput.fill('Table 99');
      await tableInput.press('Enter');
      await tableUpdate;
      await expect(tableInput).toHaveValue('Table 99');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByLabel(`Table assignment for ${guestName}`)).toHaveValue('Table 99');
    } finally {
      await deleteGuestIfPresent(page, guestName).catch(() => {});
      await deleteStalePlaywrightGuests(page).catch(() => {});
    }
  });

  test('creates, verifies, and deletes a hotel block with booking details', async ({ page }, testInfo) => {
    const hotelName = stamp('Playwright Hotel', testInfo.project.name);

    try {
      await deleteHotelIfPresent(page, hotelName);
      await gotoApp(page, '/hotels', /hotel/i);

      await page.getByRole('button', { name: /add hotel|add first hotel/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(/add hotel block/i);
      await dialog.getByPlaceholder(/marriott/i).fill(hotelName);
      await dialog.getByPlaceholder(/123 main st/i).fill('123 Playwright Ave');
      await dialog.getByRole('textbox', { name: 'Newark', exact: true }).fill('Garfield');
      await dialog.getByPlaceholder(/^NJ$/i).fill('NJ');
      await dialog.getByPlaceholder(/07101/i).fill('07026');
      await dialog.getByPlaceholder(/https:\/\//i).fill('https://example.com/book');
      await dialog.getByPlaceholder(/WEDDING2025/i).fill('PWTEST');
      await dialog.getByPlaceholder(/Smith-Johnson Wedding/i).fill('Playwright Wedding Block');
      await dialog.locator('input[type="date"]').nth(0).fill('2036-06-01');
      await dialog.locator('input[type="date"]').nth(1).fill('2036-07-23');
      await dialog.locator('input[type="date"]').nth(2).fill('2036-07-25');
      await fillMoneyInput(dialog, 0, '199');
      await dialog.getByPlaceholder(/^20$/i).fill('10');
      await dialog.getByPlaceholder(/1\.2 mi from venue/i).fill('2.5 mi from venue');
      await dialog.getByRole('button', { name: /add hotel block/i }).click();

      await expect(page.locator('body')).toContainText(hotelName, { timeout: 15_000 });
      await expect(page.locator('body')).toContainText(/PWTEST|Playwright Wedding Block|2\.5 mi/i);
    } finally {
      await deleteHotelIfPresent(page, hotelName).catch(() => {});
    }
  });

  test('adds a vendor line item in Budget and confirms it syncs back to Vendor Tracking', async ({ page }, testInfo) => {
    const vendorName = stamp('Playwright Budget Vendor', testInfo.project.name);

    try {
      await deleteVendorIfPresent(page, vendorName);
      await gotoApp(page, '/budget', /budget|vendor expenses/i);

      await page.getByText(/vendor expenses/i).scrollIntoViewIfNeeded().catch(() => {});
      const addVendorLineItem = await firstVisibleLocator([
        page.getByRole('button', { name: /add vendor line item/i }),
        page.locator('button[aria-label*="Add vendor line item" i]'),
        page.locator('button[title*="Add vendor line item" i]'),
      ]);
      expect(addVendorLineItem, 'Add vendor line item button').not.toBeNull();
      await addVendorLineItem?.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(/add vendor line item/i);
      await dialog.getByPlaceholder(/vendor name/i).fill(vendorName);
      await fillMoneyInput(dialog, 0, '555');
      await fillMoneyInput(dialog, 1, '100');
      await dialog.getByRole('button', { name: /add vendor line item/i }).click();

      await expect(page.locator('body')).toContainText(vendorName, { timeout: 15_000 });

      await gotoApp(page, '/vendors', /vendor/i);
      await expect(page.locator('body')).toContainText(vendorName, { timeout: 15_000 });
    } finally {
      await deleteVendorIfPresent(page, vendorName).catch(() => {});
    }
  });
});
