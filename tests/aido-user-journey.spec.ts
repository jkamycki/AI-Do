import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const authStatePath = path.join(process.cwd(), '.auth', 'user.json');
const hasAuthState = fs.existsSync(authStatePath);

const coreJourney = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    expected: /dashboard|wedding|budget|guest|vendor/i,
  },
  {
    path: '/profile',
    label: 'Profile',
    expected: /profile|wedding|partner|venue|country/i,
  },
  {
    path: '/timeline',
    label: 'Timeline',
    expected: /timeline|wedding day|regenerate|pdf/i,
  },
  {
    path: '/checklist',
    label: 'Checklist',
    expected: /checklist|task|download|generate/i,
  },
  {
    path: '/vendors',
    label: 'Vendors',
    expected: /vendor|contract|message|contact/i,
  },
  {
    path: '/budget/summary',
    label: 'Budget Summary',
    expected: /budget|vendor expenses|miscellaneous expenses|remaining|payment/i,
  },
  {
    path: '/documents',
    label: 'Documents',
    expected: /document|upload|download|folder|contract/i,
  },
  {
    path: '/guests',
    label: 'Guests',
    expected: /guest|rsvp|save the date|plus one|invitation/i,
  },
  {
    path: '/wedding-party',
    label: 'Wedding Party',
    expected: /wedding party|groomsman|bridesmaid|groom|bride|member/i,
  },
  {
    path: '/seating-chart',
    label: 'Seating Chart',
    expected: /seating|table|guest/i,
  },
  {
    path: '/hotels',
    label: 'Hotels',
    expected: /hotel|block|room|cutoff|booking/i,
  },
  {
    path: '/contracts',
    label: 'Contracts',
    expected: /contract|analyze|upload|vendor|hotel/i,
  },
  {
    path: '/website-editor',
    label: 'Website Editor',
    expected: /website|publish|preview|rsvp|photo/i,
  },
  {
    path: '/aria',
    label: 'Aria',
    expected: /aria|assistant|ask|message/i,
  },
  {
    path: '/day-of',
    label: 'Day Of',
    expected: /day-of|timeline|emergency|vendor|photo/i,
  },
  {
    path: '/settings',
    label: 'Settings',
    expected: /settings|account|workspace|email|language/i,
  },
  {
    path: '/help',
    label: 'Help',
    expected: /help|support|feedback|updates/i,
  },
  {
    path: '/operations-center',
    label: 'Operations Center',
    expected: /operations center|admin|restore|recovery|support/i,
  },
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

async function visible(locator: Locator) {
  return locator.first().isVisible({ timeout: 1200 }).catch(() => false);
}

async function clickIfVisible(locator: Locator) {
  if (!(await visible(locator))) return false;
  await locator.first().click();
  return true;
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

async function expectVisibleMainContent(page: Page, label: string, expected: RegExp) {
  await expect
    .poll(
      () => hasVisibleMainContent(page, expected),
      { message: `${label} page content`, timeout: 25_000 },
    )
    .toBe(true);
}

async function hasVisibleMainContent(page: Page, expected: RegExp) {
  const candidates = page.locator('main, [role="main"]').filter({ hasText: expected });
  const count = await candidates.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    if (await visible(candidates.nth(index))) return true;
  }
  return false;
}

async function closeAnyOverlay(page: Page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);

  const closeButtons = [
    page.getByRole('button', { name: /^cancel$/i }),
    page.getByRole('button', { name: /^close$/i }),
    page.getByLabel(/^close$/i),
  ];

  for (const button of closeButtons) {
    if (await clickIfVisible(button)) {
      await page.waitForTimeout(250);
      return;
    }
  }
}

async function ensureSignedIn(page: Page) {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const dashboardReady = await page
    .locator('main, [role="main"]')
    .filter({ hasText: /dashboard|wedding|budget|guest|vendor/i })
    .first()
    .isVisible({ timeout: 1500 })
    .catch(() => false);

  if (dashboardReady && !/sign-in|sign-up/i.test(page.url())) return;

  await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /sign in to test account/i }).click();
  if (!/\/dashboard(?:\?|#|$)/.test(new URL(page.url()).pathname)) {
    await page.getByRole('button', { name: /continue as/i }).click({ timeout: 30_000 });
  }
  await expect(page).toHaveURL(/\/dashboard(?:\?|#|$)/, { timeout: 30_000 });
  await expectVisibleMainContent(page, 'Dashboard', /dashboard|wedding|budget|guest|vendor/i);
}

async function expectHealthyPage(page: Page, label: string, failures: string[]) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(900);

  await expect(page).not.toHaveURL(/sign-in|sign-up/i);
  await expect(page.locator('body')).not.toContainText(/we'?re working on it/i);
  await expect(page.locator('body')).not.toContainText(/something went wrong/i);
  await expect(page.locator('body')).not.toContainText(/internal server error/i);
  await expect(page.locator('body')).not.toContainText(/unauthorized/i);

  const badImages = await page.evaluate(() =>
    Array.from(document.images)
      .filter((image) => image.currentSrc && image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc),
  );

  expect(badImages, `${label} has broken images`).toEqual([]);
  expect(failures, `${label} browser errors`).toEqual([]);
}

async function visitFeature(page: Page, pathName: string, label: string, expected: RegExp) {
  const failures = collectPageFailures(page);
  let response = await page.goto(pathName, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  if (!(await hasVisibleMainContent(page, expected))) {
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const redirectedAway = new URL(page.url()).pathname !== pathName;
    if (redirectedAway || /start planning free|plan your perfect day|sign in|get started free/i.test(bodyText)) {
      await ensureSignedIn(page);
      response = await page.goto(pathName, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
    }
  }

  expect(response?.ok(), `${label} HTTP response`).toBeTruthy();
  await expectVisibleMainContent(page, label, expected);
  await expectHealthyPage(page, label, failures);
}

test.describe('A.IDO user journey', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90_000);
  test.use({ storageState: hasAuthState ? authStatePath : undefined });

  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasAuthState,
      'Missing .auth/user.json. Run: npx.cmd playwright codegen --save-storage=.auth/user.json https://aidowedding.net',
    );
    await ensureSignedIn(page);
  });

  test('walks the main signed-in product areas like a user', async ({ page }) => {
    for (const route of coreJourney) {
      await visitFeature(page, route.path, route.label, route.expected);
    }
  });

  test('budget workflow opens vendor expense controls without saving junk data', async ({ page }) => {
    await visitFeature(page, '/budget', 'Budget & Payments', /vendor expenses|budget|payment/i);
    await page.getByText(/vendor expenses/i).scrollIntoViewIfNeeded().catch(() => {});

    const addVendorLineItem = await firstVisibleLocator([
      page.getByRole('button', { name: /add vendor line item/i }),
      page.locator('button[aria-label*="Add vendor line item" i]'),
      page.locator('button[title*="Add vendor line item" i]'),
      page.locator('button').filter({ hasText: /add vendor line item/i }),
    ]);

    expect(addVendorLineItem, 'Add vendor line item control is visible').not.toBeNull();
    await addVendorLineItem?.click();

    if (await visible(page.getByRole('dialog'))) {
      await expect(page.getByRole('dialog')).toContainText(/vendor|category|cost|remaining/i);
      await closeAnyOverlay(page);
    }

    await expectHealthyPage(page, 'Budget workflow', collectPageFailures(page));
  });

  test('guest list and invitation workflow exposes RSVP and save-the-date tools', async ({ page }) => {
    await visitFeature(page, '/guests', 'Guest List', /guest|rsvp|save the date|invitation/i);

    await expect(page.locator('body')).toContainText(/rsvp|save the date/i);
    const addGuestButton = await firstVisibleLocator([
      page.getByRole('button', { name: /add guest/i }),
      page.getByRole('button', { name: /^\+$/i }),
    ]);
    const openedAddGuest = Boolean(addGuestButton);
    await addGuestButton?.click();

    if (openedAddGuest && (await visible(page.getByRole('dialog')))) {
      await expect(page.getByRole('dialog')).toContainText(/guest|name|email|plus one|country/i);
      await closeAnyOverlay(page);
    }

    await expectHealthyPage(page, 'Guest workflow', collectPageFailures(page));
  });

  test('invitation studio previews save-the-date, RSVP, digital, and print flows', async ({ page }) => {
    await visitFeature(page, '/guests', 'Guest List & Invitations', /guest list|invitation/i);
    await expectVisibleMainContent(page, 'Guest List & Invitations', /guest list & invitations/i);

    const invitationStudioTab = await firstVisibleLocator([
      page.locator('main').getByRole('tab', { name: /invitation studio/i }),
      page.locator('main').getByRole('button', { name: /invitation studio/i }),
      page.locator('main').getByText(/^Invitation Studio$/i),
    ]);
    expect(invitationStudioTab, 'Invitation Studio tab/button is visible').not.toBeNull();
    await invitationStudioTab?.click();

    await expect(page.locator('main')).toContainText(/invitation studio/i, { timeout: 25_000 });
    await expect(page.locator('body')).toContainText(/save the date/i);
    await expect(page.locator('body')).toContainText(/rsvp/i);
    await expect(page.locator('body')).toContainText(/digital/i);
    await expect(page.locator('body')).toContainText(/print/i);

    const saveTheDateButton = page.getByRole('button', { name: /save date|save the date/i }).first();
    const rsvpInvitationButton = page.getByRole('button', { name: /^rsvp$|rsvp invitation/i }).first();
    const digitalButton = page.getByRole('button', { name: /^digital$/i }).first();
    const printButton = page.getByRole('button', { name: /^print$/i }).first();

    await saveTheDateButton.click();
    await expect(page.locator('body')).toContainText(/formal invitation to follow|save the date message|save-the-dates/i);

    await printButton.click();
    await expect(page.locator('body')).toContainText(/print settings|print size|download print pdf/i);
    await expect(page.locator('body')).toContainText(/front-only|print layout|save-the-dates/i);

    await rsvpInvitationButton.click();
    await expect(page.locator('body')).toContainText(/invitation message|rsvp by|guest rsvp flow preview|\brsvp\b/i);
    await expect(page.locator('body')).toContainText(/hotel|meal|rsvp/i);

    await digitalButton.click();
    await expect(page.locator('body')).toContainText(/send from guest list|open guest list|preview|rsvp/i);

    const messageBox = page.getByRole('textbox').filter({ hasText: /./ }).first();
    const anyTextbox = page.getByRole('textbox').first();
    if (await visible(messageBox)) {
      await expect(messageBox).toBeVisible();
    } else if (await visible(anyTextbox)) {
      await expect(anyTextbox).toBeVisible();
    }

    await expectHealthyPage(page, 'Invitation Studio workflow', collectPageFailures(page));
  });

  test('timeline generator prompt can be edited without forcing a slow generation', async ({ page }) => {
    await visitFeature(page, '/timeline', 'Timeline', /timeline|wedding day/i);

    const promptBox = page
      .getByPlaceholder(/vision|calm|intimate|high-energy|day/i)
      .or(page.getByRole('textbox').first());

    if (await visible(promptBox)) {
      await promptBox.fill('Playwright check: calm ceremony, photos before cocktail hour, energetic reception.');
      await expect(promptBox).toHaveValue(/Playwright check/);
    }

    await expectHealthyPage(page, 'Timeline workflow', collectPageFailures(page));
  });

  test('hotel block workflow exposes booking details needed for save-the-dates', async ({ page }) => {
    await visitFeature(page, '/hotels', 'Hotels', /hotel|block|room|booking/i);

    await expect(page.locator('body')).toContainText(/hotel|room|cutoff|booking/i);
    await clickIfVisible(page.getByRole('button', { name: /add hotel|add first hotel/i }));

    if (await visible(page.getByRole('dialog'))) {
      await expect(page.getByRole('dialog')).toContainText(/hotel|check-in|check out|cutoff|discount|booking/i);
      await closeAnyOverlay(page);
    }

    await expectHealthyPage(page, 'Hotel workflow', collectPageFailures(page));
  });

  test('website editor preview and invitation media load', async ({ page }) => {
    await visitFeature(page, '/website-editor', 'Website Editor', /website|preview|rsvp|publish/i);

    await clickIfVisible(page.getByRole('button', { name: /mobile view/i }));
    await page.waitForTimeout(400);
    await clickIfVisible(page.getByRole('button', { name: /desktop view/i }));

    await expectHealthyPage(page, 'Website editor workflow', collectPageFailures(page));
  });

  test('website URL can be edited after unpublishing', async ({ page }) => {
    const websiteFixture = {
      id: 999001,
      profileId: 999001,
      slug: 'old-published-link',
      theme: 'classic',
      layoutStyle: 'classic',
      font: 'playfair',
      accentColor: '#8D294D',
      colorPalette: {
        primary: '#8D294D',
        secondary: '#D86F67',
        accent: '#F2B8A0',
        neutral: '#F8EFEA',
        background: '#FFF9F6',
        text: '#3A1826',
      },
      sectionsEnabled: {
        welcome: true,
        story: true,
        schedule: true,
        travel: true,
        registry: true,
        faq: true,
        gallery: true,
        weddingParty: true,
        rsvp: true,
      },
      customText: {},
      textStyles: {},
      textPositions: {},
      galleryImages: [],
      heroImages: [],
      heroImage: null,
      passwordEnabled: false,
      published: false,
      publishedAt: '2026-01-01T00:00:00.000Z',
      lastUpdated: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      portalParty: [],
    };

    await page.route('**/api/website/me', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(websiteFixture),
      });
    });

    await page.route('**/api/website/slug', async (route) => {
      const requestBody = JSON.parse(route.request().postData() || '{}') as { slug?: string };
      expect(route.request().method()).toBe('PUT');
      expect(requestBody.slug).toBe('new-unpublished-link');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...websiteFixture,
          slug: requestBody.slug,
          lastUpdated: '2026-01-03T00:00:00.000Z',
        }),
      });
    });

    await visitFeature(page, '/website-editor', 'Website Editor URL settings', /website|preview|rsvp|publish/i);

    await clickIfVisible(page.getByRole('button', { name: /^settings$/i }).last());
    await expect(page.getByText(/guest website link/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).toContainText(/\/w\/old-published-link/i);
    await expect(page.locator('body')).not.toContainText(/\/w\/old-published-link\/home/i);

    const editUrlButton = page.getByRole('button', { name: /edit url/i });
    await expect(editUrlButton).toBeEnabled();
    await editUrlButton.click();

    await page.getByPlaceholder('your-url-slug').fill('new-unpublished-link');
    await page.getByRole('button', { name: /save url/i }).click();
    await expect(page.getByText(/new-unpublished-link/i)).toBeVisible();

    await expectHealthyPage(page, 'Website URL edit after unpublish', collectPageFailures(page));
  });

  test('public wedding website home uses the clean slug URL', async ({ page }) => {
    await page.route('**/api/website/public/clean-home-link', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          slug: 'clean-home-link',
          theme: 'classic',
          layoutStyle: 'classic',
          font: 'Playfair Display',
          accentColor: '#8D294D',
          publicWebsiteUrl: '/w/clean-home-link',
          colorPalette: {
            primary: '#8D294D',
            secondary: '#D86F67',
            accent: '#F2B8A0',
            neutral: '#F8EFEA',
            background: '#FFF9F6',
            text: '#3A1826',
          },
          sectionsEnabled: {
            welcome: true,
            story: true,
            schedule: true,
            travel: true,
            registry: true,
            faq: true,
            gallery: true,
            weddingParty: true,
            rsvp: true,
          },
          customText: {
            welcome: 'Clean URL wedding website home page',
          },
          textStyles: {},
          textPositions: {},
          galleryImages: [],
          heroImages: [],
          heroImage: null,
          couple: {
            partner1Name: 'Joseph',
            partner2Name: 'Gabriela',
            weddingDate: '2027-04-24',
            ceremonyTime: '16:00',
            receptionTime: '18:00',
            venue: 'The Venue',
            location: 'Garfield, NJ',
            venueCity: 'Garfield',
            venueState: 'NJ',
            venueZip: '07026',
          },
        }),
      });
    });

    const response = await page.goto('/w/clean-home-link/home', { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), 'Public website HTTP response').toBeTruthy();
    await expect(page).toHaveURL(/\/w\/clean-home-link$/);
    await expect(page.locator('body')).toContainText(/Gabriela|Joseph|Clean URL wedding website home page/i);
    await expect(page.locator('body')).not.toContainText(/\/w\/clean-home-link\/home/i);
  });

  test('documents and contracts expose upload/download paths safely', async ({ page }) => {
    await visitFeature(page, '/documents', 'Documents', /document|upload|download|folder/i);
    await expect(page.locator('body')).toContainText(/upload|download|folder|organize/i);

    await visitFeature(page, '/contracts', 'Contracts', /contract|analyze|upload/i);
    await expect(page.locator('body')).toContainText(/upload|analyze|contract/i);
  });
});
