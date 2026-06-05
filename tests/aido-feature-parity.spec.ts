import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const authStatePath = path.join(process.cwd(), '.auth', 'user.json');
const hasAuthState = fs.existsSync(authStatePath);

const now = '2026-06-04T12:00:00.000Z';

const profile = {
  id: 321,
  partner1Name: 'Joseph',
  partner2Name: 'Gabriela',
  weddingDate: '2027-04-24',
  ceremonyTime: '16:00',
  receptionTime: '18:00',
  venue: 'The Glasshouse',
  location: 'Garfield, NJ',
  venueCity: 'Garfield',
  venueState: 'NJ',
  venueZip: '07026',
  venueCountry: 'US',
  ceremonyAtVenue: true,
  guestCount: 120,
  totalBudget: 45000,
  weddingVibe: 'Elegant city garden',
  preferredLanguage: 'English',
  vendorBccEmail: null,
  taskEmailRemindersEnabled: true,
  taskReminderDaysBefore: 7,
  updatedAt: now,
  createdAt: now,
};

const vendor = {
  id: 77,
  profileId: profile.id,
  name: 'Lumen & Lace Photo',
  category: 'Photographer',
  email: 'hello@lumenandlace.example',
  phone: '(555) 021-1402',
  website: 'https://example.com/lumen',
  portalLink: 'https://example.com/lumen/portal',
  notes: 'Editorial, calm direction, strong reception coverage.',
  totalCost: 4200,
  depositAmount: 800,
  contractSigned: false,
  nextPaymentDue: '2027-02-01',
  files: [],
  payments: [],
  createdAt: now,
  updatedAt: now,
};

const conversation = {
  id: 901,
  vendorId: vendor.id,
  vendorName: vendor.name,
  vendorEmail: vendor.email,
  inboundAddress: 'reply+901@aidowedding.example',
  subject: 'Gabriela and Joseph wedding photography',
  unreadCount: 1,
};

const rsvpGuest = {
  id: 1001,
  profileId: profile.id,
  name: 'Jordan Rivera',
  email: 'jordan@example.com',
  rsvpStatus: 'pending',
  invitationStatus: 'sent',
  mealChoice: null,
  dietaryNotes: null,
  guestGroup: 'Friends',
  plusOne: false,
  plusOneName: null,
  tableAssignment: null,
  needsHotel: false,
  bookedHotelBlockId: null,
  bookedHotelRoomCount: null,
  notes: null,
  rsvpMessage: null,
  source: null,
  acknowledgedAt: null,
  rsvpReminderStatus: 'not_sent',
  createdAt: now,
};

const contractAnalysis = {
  overallRiskLevel: 'high',
  vendorType: 'Photography',
  summary: 'Review the cancellation and overtime language before signing.',
  redFlags: [{
    severity: 'high',
    title: 'Uncapped overtime fees',
    detail: 'The agreement does not define when overtime starts or the hourly rate.',
    recommendation: 'Ask the vendor to cap overtime and add a written approval step.',
  }],
  keyTerms: [{ label: 'Coverage', value: '8 hours' }],
  cancellationPolicy: 'Retainer is non-refundable after 30 days.',
  paymentTerms: '50% deposit and final payment 14 days before the event.',
  liabilityNotes: 'Liability cap is not clearly stated.',
  positives: ['Delivery timeline is included.'],
  missingClauses: ['No force majeure language.'],
  negotiationTips: ['Request a clear overtime approval process.'],
};

const publicWebsitePayload = {
  slug: 'parity-wedding',
  theme: 'classic',
  layoutStyle: 'classic',
  font: 'Playfair Display',
  accentColor: '#8D294D',
  publicWebsiteUrl: '/parity-wedding',
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
    welcome: 'Welcome to our wedding weekend.',
    story: 'A small city garden celebration with our favorite people.',
    schedule: 'Cocktail hour starts after family photos.',
    travel: 'Parking is available behind the venue.',
    registry: 'Your presence is the greatest gift.',
    faq_items_json: JSON.stringify([
      { question: 'What should I wear?', answer: 'Garden formal attire.' },
    ]),
    gallery_subtitle: 'Moments from us and our guests.',
    rsvp_deadline: 'March 24, 2027',
  },
  textStyles: {},
  textPositions: {},
  galleryImages: [
    { url: '/images/default-wedding-couple.jpg', caption: 'Engagement evening', order: 0 },
  ],
  heroImages: [],
  heroImage: null,
  portalParty: [
    { id: 1, name: 'Maya Bennett', role: 'Maid of Honor', side: 'bride', photoUrl: null, sortOrder: 1 },
  ],
  hotelOptions: [
    {
      id: 10,
      hotelName: 'A.IDO Hotel Block',
      bookingLink: 'https://example.com/book',
      discountCode: 'AIDO2027',
      groupName: 'Gabriela & Joseph Wedding',
      cutoffDate: '2027-03-24',
      checkInDate: '2027-04-23',
      checkOutDate: '2027-04-25',
      phone: '(555) 555-1234',
      address: '123 Market St',
      city: 'Garfield',
      state: 'NJ',
      zip: '07026',
      distanceFromVenue: '0.8 mi from venue',
    },
  ],
  mealOptions: [
    { value: 'beef', label: 'Beef' },
    { value: 'vegetarian', label: 'Vegetarian' },
  ],
  guestPhotoDrop: {
    enabled: true,
    galleryEnabled: true,
    displayMode: 'both',
    approvalRequired: true,
    maxUploads: 20,
    uploadLimitMb: 10,
    title: 'Share your favorite photos',
    instructions: 'Upload the candid moments you capture.',
    photos: [
      {
        id: 5,
        guestName: 'Sam Guest',
        note: 'Ceremony smiles',
        caption: 'Ceremony smiles',
        imageUrl: '/images/floral-bg-optimized.jpg',
        publicImageUrl: '/images/floral-bg-optimized.jpg',
        status: 'approved',
        createdAt: now,
      },
    ],
  },
  couple: {
    partner1Name: profile.partner1Name,
    partner2Name: profile.partner2Name,
    weddingDate: profile.weddingDate,
    ceremonyTime: profile.ceremonyTime,
    receptionTime: profile.receptionTime,
    venue: profile.venue,
    location: profile.location,
    venueCity: profile.venueCity,
    venueState: profile.venueState,
    venueZip: profile.venueZip,
  },
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function visible(locator: Locator, timeout = 1500) {
  return locator.first().isVisible({ timeout }).catch(() => false);
}

async function expectNoPageHorizontalOverflow(page: Page, label: string) {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(
    Math.max(dimensions.documentWidth, dimensions.bodyWidth),
    `${label} should not create page-level horizontal scrolling`,
  ).toBeLessThanOrEqual(dimensions.viewportWidth + 2);
}

async function expectAppReady(page: Page, expected: RegExp) {
  await expect
    .poll(
      async () => {
        const text = await page.locator('body').innerText().catch(() => '');
        return expected.test(text);
      },
      { message: 'Expected app content', timeout: 25_000 },
    )
    .toBe(true);
  await expect(page).not.toHaveURL(/sign-in|sign-up/i);
  await expect(page.locator('body')).not.toContainText(/we'?re working on it|something went wrong|internal server error|unauthorized/i);
}

async function mockSignedInAppBasics(page: Page) {
  await page.route('**/api/profile', (route) => fulfillJson(route, profile));
  await page.route('**/api/vendors/financials', (route) =>
    fulfillJson(route, {
      totalCommitted: vendor.totalCost,
      totalDeposits: vendor.depositAmount,
      totalPaidMilestones: 0,
      totalPaid: vendor.depositAmount,
      vendorCount: 1,
    }));
  await page.route('**/api/vendors', (route) => {
    if (route.request().method() === 'GET') return fulfillJson(route, [vendor]);
    return route.fallback();
  });
  await page.route(`**/api/vendors/${vendor.id}`, (route) => {
    if (route.request().method() === 'GET') return fulfillJson(route, vendor);
    return route.fallback();
  });
  await page.route('**/api/hotels', (route) => fulfillJson(route, []));
  await page.route('**/api/messaging/conversations', (route) => {
    if (route.request().method() === 'GET') {
      return fulfillJson(route, [{
        id: conversation.id,
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorEmail: vendor.email,
        subject: conversation.subject,
        lastMessagePreview: 'Could you clarify the overtime fee?',
        lastMessageAt: now,
        unreadCount: 1,
      }]);
    }
    return route.fallback();
  });
  await page.route(`**/api/messaging/conversations/by-vendor/${vendor.id}`, (route) => fulfillJson(route, conversation));
  await page.route(`**/api/messaging/conversations/${conversation.id}/read`, (route) => fulfillJson(route, { success: true }));
  await page.route(`**/api/messaging/conversations/${conversation.id}/suggest-reply`, (route) =>
    fulfillJson(route, { draft: 'Thanks for flagging this. Could you confirm the overtime rate and meal-break terms?' }));
}

async function mockCalendarSources(page: Page) {
  await page.route('**/api/checklist', (route) =>
    fulfillJson(route, {
      generatedAt: now,
      items: [
        {
          id: 7001,
          month: '6 months before',
          task: 'Book engagement session outfits',
          description: 'Coordinate with photographer and planner.',
          dueDate: '2027-01-15',
          isCompleted: false,
        },
      ],
    }));
  await page.route('**/api/budget', (route) =>
    fulfillJson(route, {
      id: 88,
      totalBudget: profile.totalBudget,
      spent: 12000,
      remaining: 33000,
      updatedAt: now,
      items: [
        {
          id: 8001,
          category: 'Florals',
          vendor: 'Petal Studio',
          estimatedCost: 3200,
          actualCost: 3500,
          amountPaid: 1000,
          isPaid: false,
          notes: 'Second installment',
          nextPaymentDue: '2027-01-20',
        },
      ],
    }));
  await page.route('**/api/timeline', (route) =>
    fulfillJson(route, {
      id: 44,
      generatedAt: now,
      events: [
        {
          id: 9001,
          title: 'Golden hour portraits',
          description: 'Planner gathers immediate family by the garden gate.',
          time: '17:20',
          category: 'photos',
        },
      ],
    }));
  await page.route('**/api/hotels', (route) =>
    fulfillJson(route, [
      {
        id: 55,
        hotelName: 'A.IDO Hotel Block',
        cutoffDate: '2027-03-24',
        checkInDate: '2027-04-23',
        checkOutDate: '2027-04-25',
      },
    ]));
}

async function mockMessagingSend(page: Page) {
  const sentBodies: unknown[] = [];
  await page.route(`**/api/messaging/conversations/${conversation.id}/messages`, async (route) => {
    if (route.request().method() === 'GET') {
      return fulfillJson(route, [
        {
          id: 1,
          conversationId: conversation.id,
          senderType: 'vendor',
          senderName: 'Maya Bennett',
          senderEmail: vendor.email,
          subject: conversation.subject,
          body: 'Could you clarify the overtime fee before we sign?',
          attachments: [],
          deliveryStatus: 'received',
          createdAt: now,
        },
      ]);
    }
    if (route.request().method() === 'POST') {
      const payload = JSON.parse(route.request().postData() || '{}');
      sentBodies.push(payload);
      return fulfillJson(route, {
        id: 2,
        conversationId: conversation.id,
        senderType: 'couple',
        senderName: 'Joseph',
        senderEmail: 'joseph@example.com',
        subject: payload.subject,
        body: payload.body,
        attachments: payload.attachments ?? [],
        deliveryStatus: 'sent',
        createdAt: now,
      });
    }
    return route.fallback();
  });
  return sentBodies;
}

async function mockContractDocumentSync(page: Page) {
  const contracts: unknown[] = [];
  const documents: unknown[] = [];

  await page.route('**/api/documents', (route) => {
    if (route.request().method() === 'GET') return fulfillJson(route, { documents });
    return route.fallback();
  });
  await page.route('**/api/contracts/upload', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const contract = {
      id: 777,
      vendorId: vendor.id,
      vendorName: vendor.name,
      hotelBlockId: null,
      hotelName: null,
      fileName: 'Lumen & Lace Agreement',
      fileSize: 2048,
      createdAt: now,
      analysis: contractAnalysis,
    };
    contracts.unshift(contract);
    documents.unshift({
      id: 778,
      fileUrl: '/objects/contracts/lumen-lace-agreement.txt',
      fileName: 'Lumen & Lace Agreement',
      originalFileName: 'lumen-lace-agreement.txt',
      fileType: 'TXT',
      mimeType: 'text/plain',
      fileSize: 2048,
      uploadedBy: 'playwright',
      linkedVendorId: vendor.id,
      linkedVendorName: vendor.name,
      summary: contractAnalysis.summary,
      extractedFields: {
        suggestedVendorId: vendor.id,
        suggestedVendorName: vendor.name,
        vendorName: vendor.name,
        paymentSchedule: [{ label: 'Final payment', amount: 2100, dueDate: '2027-04-10' }],
        dueDates: [{ label: 'Cancellation notice', date: '2027-03-24' }],
        cancellationPolicy: contractAnalysis.cancellationPolicy,
        deliverables: ['8 hours of photo coverage'],
        contactInfo: { name: 'Maya Bennett', email: vendor.email, phone: vendor.phone },
      },
      tags: ['Contract'],
      folder: 'Contracts',
      visibility: [],
      createdAt: now,
      updatedAt: now,
    });
    return fulfillJson(route, { id: 777, analysis: contractAnalysis, fileName: 'lumen-lace-agreement.txt' });
  });
  await page.route('**/api/contracts', (route) => {
    if (route.request().method() === 'GET') return fulfillJson(route, contracts);
    return route.fallback();
  });

  return { contracts, documents };
}

async function mockGuestReminderApis(page: Page) {
  const reminderSends: number[] = [];
  const guests = [rsvpGuest];

  await page.route('**/api/guests', (route) => {
    if (route.request().method() === 'GET') {
      return fulfillJson(route, {
        guests,
        summary: {
          total: guests.length,
          attending: guests.filter((guest) => guest.rsvpStatus === 'attending').length,
          declined: guests.filter((guest) => guest.rsvpStatus === 'declined').length,
          pending: guests.filter((guest) => guest.rsvpStatus === 'pending').length,
          plusOnes: guests.filter((guest) => guest.plusOne).length,
        },
      });
    }
    return route.fallback();
  });
  await page.route('**/api/wedding-party', (route) => fulfillJson(route, []));
  await page.route('**/api/invitation-shares/links', (route) =>
    fulfillJson(route, {
      rsvpUrl: 'https://aidowedding.example/rsvp/shared/demo',
      reminderUrl: 'https://aidowedding.example/rsvp/shared/reminder-demo',
      saveTheDateUrl: 'https://aidowedding.example/save-the-date/demo',
    }));
  await page.route('**/api/invitation-customizations', (route) =>
    fulfillJson(route, {
      useGeneratedInvitation: false,
      saveTheDatePhotoUrl: null,
      digitalInvitationPhotoUrl: null,
      saveTheDatePhotoPosition: null,
      digitalInvitationPhotoPosition: null,
      colorPalette: null,
      customColors: null,
      selectedFont: null,
      selectedLayout: null,
      saveTheDateFont: 'Playfair Display',
      digitalInvitationFont: 'Playfair Display',
      saveTheDateLayout: 'classic',
      digitalInvitationLayout: 'classic',
      saveTheDateBackground: null,
      digitalInvitationBackground: null,
      saveTheDateFontColor: null,
      digitalInvitationFontColor: null,
      saveTheDateFontSize: null,
      digitalInvitationFontSize: null,
      saveTheDateAccentColor: null,
      digitalInvitationAccentColor: null,
      textOverrides: {},
      rsvpByDate: '2027-03-24',
    }));
  await page.route(`**/api/guests/${rsvpGuest.id}/send-rsvp?reminder=true`, (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    reminderSends.push(rsvpGuest.id);
    rsvpGuest.rsvpReminderStatus = 'sent';
    return fulfillJson(route, {
      rsvpUrl: `https://aidowedding.example/rsvp/${rsvpGuest.id}`,
      emailSent: true,
    });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem('aido_guest_send_protection', 'false');
  });

  return { reminderSends };
}

async function mockPublicRsvpApis(page: Page) {
  const submittedRsvps: unknown[] = [];
  await page.route('**/api/website/public/parity-wedding/guests/search**', (route) =>
    fulfillJson(route, {
      matches: [{ id: rsvpGuest.id, name: rsvpGuest.name, rsvpStatus: 'pending' }],
    }));
  await page.route(`**/api/website/public/parity-wedding/guests/${rsvpGuest.id}**`, (route) =>
    fulfillJson(route, {
      id: rsvpGuest.id,
      name: rsvpGuest.name,
      rsvpStatus: 'pending',
      mealChoice: null,
      dietaryNotes: null,
      plusOne: false,
      plusOneStatus: 'none',
      plusOneName: null,
      plusOneMealChoice: null,
      needsHotel: false,
      bookedHotelBlockId: null,
      bookedHotelRoomCount: null,
    }));
  await page.route('**/api/website/public/parity-wedding/rsvp', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const payload = JSON.parse(route.request().postData() || '{}');
    submittedRsvps.push(payload);
    return fulfillJson(route, { ok: true, guestId: payload.guestId });
  });
  return { submittedRsvps };
}

function editorPublicPayload(record: typeof publicWebsitePayload & {
  id: number;
  profileId: number;
  published: boolean;
}) {
  return {
    ...publicWebsitePayload,
    slug: record.slug,
    theme: record.theme,
    layoutStyle: record.layoutStyle,
    font: record.font,
    accentColor: record.accentColor,
    publicWebsiteUrl: `/${record.slug}`,
    colorPalette: record.colorPalette,
    sectionsEnabled: record.sectionsEnabled,
    customText: record.customText,
    textStyles: record.textStyles,
    textPositions: record.textPositions,
    galleryImages: record.galleryImages,
    heroImages: record.heroImages,
    heroImage: record.heroImage,
    portalParty: record.portalParty,
    hotelOptions: record.hotelOptions,
    mealOptions: record.mealOptions,
    guestPhotoDrop: record.guestPhotoDrop,
    couple: record.couple,
  };
}

async function mockWebsiteEditorApis(page: Page) {
  const updateBodies: Array<Record<string, unknown>> = [];
  const publishBodies: Array<Record<string, unknown>> = [];
  const uploadedObjects: string[] = [];
  const mediaRequests: string[] = [];
  let currentPassword: string | null = null;
  let websiteRecord = {
    ...publicWebsitePayload,
    id: 4242,
    profileId: profile.id,
    slug: 'parity-editor',
    publicWebsiteUrl: '/parity-editor',
    passwordEnabled: false,
    published: true,
    publishedAt: '2026-06-04T12:00:00.000Z',
    lastUpdated: '2026-06-04T12:00:00.000Z',
    createdAt: '2026-06-04T12:00:00.000Z',
    customText: {
      ...publicWebsitePayload.customText,
      welcome: 'Original app welcome copy.',
      welcome_title: 'Welcome',
    },
  };

  await page.route('**/api/website/me', (route) => {
    if (route.request().method() === 'GET') return fulfillJson(route, websiteRecord);
    return route.fallback();
  });
  await page.route('**/api/website/update', (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    const body = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
    const bodyForRecord = { ...body };
    if (Object.prototype.hasOwnProperty.call(body, 'password')) {
      if (typeof body.password === 'string' && body.password.trim()) {
        currentPassword = body.password.trim();
        bodyForRecord.passwordEnabled = true;
      } else {
        currentPassword = null;
        bodyForRecord.passwordEnabled = false;
      }
      delete bodyForRecord.password;
    }
    updateBodies.push(body);
    websiteRecord = {
      ...websiteRecord,
      ...bodyForRecord,
      customText: {
        ...websiteRecord.customText,
        ...((body.customText as Record<string, string> | undefined) ?? {}),
      },
      textStyles: (body.textStyles as typeof websiteRecord.textStyles | undefined) ?? websiteRecord.textStyles,
      textPositions: (body.textPositions as typeof websiteRecord.textPositions | undefined) ?? websiteRecord.textPositions,
      galleryImages: (body.galleryImages as typeof websiteRecord.galleryImages | undefined) ?? websiteRecord.galleryImages,
      heroImages: (body.heroImages as typeof websiteRecord.heroImages | undefined) ?? websiteRecord.heroImages,
      heroImage: (body.heroImage as typeof websiteRecord.heroImage | undefined) ?? websiteRecord.heroImage,
      lastUpdated: '2026-06-04T12:00:01.000Z',
    };
    return fulfillJson(route, websiteRecord);
  });
  await page.route('**/api/website/publish', (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    const body = JSON.parse(route.request().postData() || '{}') as { published?: boolean };
    publishBodies.push(body);
    websiteRecord = {
      ...websiteRecord,
      published: Boolean(body.published),
      publishedAt: body.published ? now : websiteRecord.publishedAt,
      lastUpdated: '2026-06-04T12:00:02.000Z',
    };
    return fulfillJson(route, websiteRecord);
  });
  await page.route('**/api/storage/uploads/request-url', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = JSON.parse(route.request().postData() || '{}') as { name?: string; contentType?: string; size?: number };
    const safeName = encodeURIComponent(body.name || `gallery-${uploadedObjects.length}.png`);
    return fulfillJson(route, {
      uploadURL: `/mock-storage-upload/${safeName}`,
      objectPath: `/objects/website-gallery/${safeName}`,
      metadata: {
        name: body.name || `gallery-${uploadedObjects.length}.png`,
        size: body.size ?? 0,
        contentType: body.contentType || 'image/png',
      },
    });
  });
  await page.route('**/mock-storage-upload/**', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    uploadedObjects.push(route.request().url());
    await route.fulfill({ status: 200, body: '' });
  });
  await page.route('**/api/storage/uploads/claim', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return fulfillJson(route, { success: true });
  });
  const imageBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64',
  );
  await page.route('**/api/storage/objects/**', async (route) => {
    mediaRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'image/png', body: imageBytes });
  });
  await page.route('**/api/website/media/**', async (route) => {
    mediaRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'image/png', body: imageBytes });
  });
  await page.route('**/api/website/public/*/media/**', async (route) => {
    mediaRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'image/png', body: imageBytes });
  });
  await page.route('**/api/invitation-customizations**', (route) =>
    fulfillJson(route, {
      customColors: {},
    }));
  await page.route('**/api/website/public/parity-editor/unlock', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    if (!websiteRecord.published) return fulfillJson(route, { error: 'Not found' }, 404);
    const body = JSON.parse(route.request().postData() || '{}') as { password?: string };
    if (currentPassword && body.password !== currentPassword) {
      return fulfillJson(route, { error: 'Incorrect password', passwordRequired: true }, 401);
    }
    return fulfillJson(route, editorPublicPayload(websiteRecord));
  });
  await page.route('**/api/website/public/parity-editor', (route) => {
    if (route.request().method() === 'GET') {
      if (!websiteRecord.published) return fulfillJson(route, { error: 'Not found' }, 404);
      if (websiteRecord.passwordEnabled) {
        return fulfillJson(route, { passwordRequired: true }, 401);
      }
      return fulfillJson(route, editorPublicPayload(websiteRecord));
    }
    return route.fallback();
  });

  return { updateBodies, publishBodies, uploadedObjects, mediaRequests };
}

async function mockGuestPhotoDropApis(page: Page) {
  const uploads: Array<{
    id: number;
    guestName: string;
    guestEmail: string | null;
    note: string | null;
    caption: string | null;
    imageUrl: string;
    publicImageUrl: string;
    originalName: string;
    fileSize: number;
    status: 'pending' | 'approved' | 'hidden';
    uploadedAt: string;
  }> = [];
  const uploadedObjects: string[] = [];
  const settings = {
    enabled: true,
    galleryEnabled: true,
    displayMode: 'both',
    approvalRequired: true,
    maxUploads: 5,
    uploadLimitMb: 10,
    title: 'Guest Photo Drop',
    instructions: 'Share your favorite wedding day moments here. Add a caption if you like.',
  };

  const summary = () => ({
    total: uploads.length,
    pending: uploads.filter((upload) => upload.status === 'pending').length,
    approved: uploads.filter((upload) => upload.status === 'approved').length,
    hidden: uploads.filter((upload) => upload.status === 'hidden').length,
  });

  await page.route('**/api/website/public/parity-wedding/photo-drop', (route) => {
    if (route.request().method() === 'GET') {
      return fulfillJson(route, {
        slug: 'parity-wedding',
        websitePublished: true,
        colorPalette: publicWebsitePayload.colorPalette,
        couple: publicWebsitePayload.couple,
        guestPhotoDrop: settings,
      });
    }
    return route.fallback();
  });
  await page.route('**/api/website/public/parity-wedding/photo-drop/usage', (route) =>
    fulfillJson(route, {
      limit: settings.maxUploads,
      uploadedCount: uploads.length,
      remaining: Math.max(0, settings.maxUploads - uploads.length),
      maxPerUpload: settings.uploadLimitMb,
    }));
  await page.route('**/api/website/public/parity-wedding/photo-drop/upload-url', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = JSON.parse(route.request().postData() || '{}') as { fileName?: string };
    return fulfillJson(route, {
      uploadUrl: `/mock-photo-upload/${encodeURIComponent(body.fileName || 'guest-photo.png')}`,
      objectPath: `guest-photo-drop/${body.fileName || 'guest-photo.png'}`,
      originalName: body.fileName || 'guest-photo.png',
    });
  });
  await page.route('**/mock-photo-upload/**', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    uploadedObjects.push(route.request().url());
    await route.fulfill({ status: 200, body: '' });
  });
  await page.route('**/api/website/public/parity-wedding/photo-drop/complete', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = JSON.parse(route.request().postData() || '{}') as {
      guestName?: string;
      caption?: string;
      objectPath?: string;
      originalName?: string;
      fileSize?: number;
    };
    const upload = {
      id: 9000 + uploads.length,
      guestName: body.guestName || 'Guest',
      guestEmail: null,
      note: body.caption || null,
      caption: body.caption || null,
      imageUrl: '/images/floral-bg-optimized.jpg',
      publicImageUrl: '/images/floral-bg-optimized.jpg',
      originalName: body.originalName || 'guest-photo.png',
      fileSize: body.fileSize || 0,
      status: 'pending' as const,
      uploadedAt: now,
    };
    uploads.unshift(upload);
    return fulfillJson(route, {
      success: true,
      message: 'Thanks! Your photos were uploaded.',
      upload,
      usage: {
        limit: settings.maxUploads,
        uploadedCount: uploads.length,
        remaining: Math.max(0, settings.maxUploads - uploads.length),
        maxPerUpload: settings.uploadLimitMb,
      },
    });
  });
  await page.route('**/api/website/photo-drop?**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillJson(route, {
      website: { slug: 'parity-wedding', published: true },
      settings,
      publicUploadUrl: '/photo-drop/parity-wedding',
      summary: summary(),
      uploads,
      page: {
        limit: 48,
        offset: 0,
        returned: uploads.length,
        hasMore: false,
        nextOffset: uploads.length,
      },
    });
  });
  await page.route('**/api/website/photo-drop/uploads/*', (route) => {
    const match = route.request().url().match(/\/uploads\/(\d+)/);
    const upload = uploads.find((candidate) => candidate.id === Number(match?.[1]));
    if (!upload) return fulfillJson(route, { error: 'Not found' }, 404);
    if (route.request().method() === 'PUT') {
      const body = JSON.parse(route.request().postData() || '{}') as { status?: 'pending' | 'approved' | 'hidden' };
      upload.status = body.status ?? upload.status;
      return fulfillJson(route, { upload });
    }
    if (route.request().method() === 'DELETE') {
      const index = uploads.indexOf(upload);
      uploads.splice(index, 1);
      return fulfillJson(route, { success: true });
    }
    return route.fallback();
  });

  return { uploads, uploadedObjects };
}

async function mockRegistryWebsiteApis(page: Page) {
  const updateBodies: Array<Record<string, unknown>> = [];
  let websiteRecord = {
    ...publicWebsitePayload,
    id: 5151,
    profileId: profile.id,
    slug: 'parity-registry',
    publicWebsiteUrl: '/parity-registry',
    passwordEnabled: false,
    published: true,
    publishedAt: '2026-06-04T12:00:00.000Z',
    lastUpdated: '2026-06-04T12:00:00.000Z',
    createdAt: '2026-06-04T12:00:00.000Z',
    customText: {
      ...publicWebsitePayload.customText,
      registry_title: 'Registry',
      registry_subtitle: 'With love',
      registry: 'Original registry note.',
      _registryLinks: '[]',
    },
  };

  await page.route('**/api/website/me', (route) => {
    if (route.request().method() === 'GET') return fulfillJson(route, websiteRecord);
    return route.fallback();
  });
  await page.route('**/api/website/update', (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    const body = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
    updateBodies.push(body);
    websiteRecord = {
      ...websiteRecord,
      ...body,
      sectionsEnabled: {
        ...websiteRecord.sectionsEnabled,
        ...((body.sectionsEnabled as typeof websiteRecord.sectionsEnabled | undefined) ?? {}),
      },
      customText: {
        ...websiteRecord.customText,
        ...((body.customText as Record<string, string> | undefined) ?? {}),
      },
      lastUpdated: '2026-06-04T12:00:02.000Z',
    };
    return fulfillJson(route, websiteRecord);
  });
  await page.route('**/api/website/public/parity-registry', (route) => {
    if (route.request().method() === 'GET') return fulfillJson(route, editorPublicPayload(websiteRecord));
    return route.fallback();
  });

  return { updateBodies };
}

async function mockHotelBlockApis(page: Page) {
  const hotels: Array<{
    id: number;
    hotelName: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    phone?: string | null;
    email?: string | null;
    bookingLink?: string | null;
    discountCode?: string | null;
    groupName?: string | null;
    cutoffDate?: string | null;
    checkInDate?: string | null;
    checkOutDate?: string | null;
    roomsReserved?: number | null;
    roomsBooked: number;
    pricePerNight?: number | null;
    distanceFromVenue?: string | null;
    notes?: string | null;
    createdAt: string;
  }> = [];
  const createdBodies: unknown[] = [];

  await page.route('**/api/hotels', (route) => {
    if (route.request().method() === 'GET') return fulfillJson(route, hotels);
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      createdBodies.push(body);
      const hotel = {
        id: 7070 + hotels.length,
        roomsBooked: 0,
        createdAt: now,
        ...body,
      };
      hotels.unshift(hotel);
      return fulfillJson(route, hotel, 201);
    }
    return route.fallback();
  });
  await page.route('**/api/guests', (route) => {
    if (route.request().method() === 'GET') {
      return fulfillJson(route, {
        guests: [],
        summary: { total: 0, attending: 0, declined: 0, pending: 0, plusOnes: 0 },
      });
    }
    return route.fallback();
  });
  await page.route('**/api/website/public/parity-hotels', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillJson(route, {
      ...publicWebsitePayload,
      slug: 'parity-hotels',
      publicWebsiteUrl: '/parity-hotels',
      customText: {
        ...publicWebsitePayload.customText,
        travel_title: 'Travel & Venue',
        travel_subtitle: 'Hotel details for guests',
        travel: 'Book early so the wedding block rate is available.',
      },
      hotelOptions: hotels,
    });
  });

  return { hotels, createdBodies };
}

async function mockWeddingPartyWebsiteApis(page: Page) {
  const members: Array<{
    id: number;
    name: string;
    role: string;
    side: string;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    photoUrl?: string | null;
    sortOrder: number;
    createdAt: string;
  }> = [];
  const createdBodies: unknown[] = [];

  await page.route('**/api/wedding-party', (route) => {
    if (route.request().method() === 'GET') return fulfillJson(route, members);
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      createdBodies.push(body);
      const member = {
        id: 8080 + members.length,
        phone: null,
        email: null,
        photoUrl: null,
        createdAt: now,
        ...body,
      };
      members.push(member);
      return fulfillJson(route, member, 201);
    }
    return route.fallback();
  });
  await page.route('**/api/website/public/parity-party', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillJson(route, {
      ...publicWebsitePayload,
      slug: 'parity-party',
      publicWebsiteUrl: '/parity-party',
      customText: {
        ...publicWebsitePayload.customText,
        weddingParty_title: 'Wedding Party',
        weddingParty_subtitle: 'The people standing with us.',
      },
      portalParty: members,
    });
  });

  return { members, createdBodies };
}

test.describe('A.IDO website and app feature parity', () => {
  test('public wedding website renders promised guest sections on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/website/public/parity-wedding', (route) => fulfillJson(route, publicWebsitePayload));
    await page.route('**/api/website/public/parity-wedding/photo-drop/usage', (route) => fulfillJson(route, { remaining: 20, used: 0 }));

    const response = await page.goto('/parity-wedding', { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), 'Public wedding website response').toBeTruthy();
    await expect(page.locator('body')).toContainText(/Gabriela|Joseph|Welcome to our wedding weekend/i);
    await expectNoPageHorizontalOverflow(page, 'Public wedding website home');

    const sectionChecks = [
      { path: '/parity-wedding/schedule', expected: /Cocktail hour starts after family photos|Schedule/i },
      { path: '/parity-wedding/travel', expected: /A\.IDO Hotel Block|Parking is available behind the venue|AIDO2027/i },
      { path: '/parity-wedding/registry', expected: /presence is the greatest gift|Registry/i },
      { path: '/parity-wedding/gallery', expected: /Moments from us and our guests|Share your favorite photos|Ceremony smiles/i },
      { path: '/parity-wedding/wedding-party', expected: /Maya Bennett|Maid of Honor|Wedding Party/i },
      { path: '/parity-wedding/faq', expected: /What should I wear|Garden formal attire/i },
      { path: '/parity-wedding/rsvp', expected: /RSVP|March 24, 2027|Your full name/i },
    ];

    for (const section of sectionChecks) {
      await page.goto(section.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toContainText(section.expected, { timeout: 10_000 });
      await expectNoPageHorizontalOverflow(page, section.path);
    }
  });

  test('public wedding website RSVP saves the guest response on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/website/public/parity-wedding', (route) => fulfillJson(route, publicWebsitePayload));
    await page.route('**/api/website/public/parity-wedding/photo-drop/usage', (route) => fulfillJson(route, { remaining: 20, used: 0 }));
    const rsvp = await mockPublicRsvpApis(page);

    const response = await page.goto('/parity-wedding/rsvp', { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), 'Public RSVP response').toBeTruthy();
    await expect(page.locator('body')).toContainText(/Will you be joining us|Find your name/i);

    await page.getByPlaceholder(/first and last name/i).fill('Jordan Rivera');
    await page.getByRole('button', { name: /find me/i }).click();
    await page.getByRole('button', { name: /Jordan Rivera/i }).click();
    await expect(page.locator('body')).toContainText(/Dear Jordan Rivera|will you be joining us/i);
    await page.getByRole('button', { name: /send response to couple/i }).click();

    await expect
      .poll(() => rsvp.submittedRsvps.length, { message: 'Public RSVP submitted', timeout: 10_000 })
      .toBe(1);
    expect(rsvp.submittedRsvps[0]).toMatchObject({
      guestId: rsvpGuest.id,
      guestName: rsvpGuest.name,
      attendance: 'attending',
      plusOne: false,
    });
    await expect(page.locator('body')).toContainText(/response has been received|couple can now see it/i);
    await expectNoPageHorizontalOverflow(page, 'Public RSVP submission');
  });

  test('guest collector keeps street, city, state, and ZIP in separate fields on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const submissions: Array<Record<string, unknown>> = [];

    await page.route('**/api/maintenance/public**', (route) =>
      fulfillJson(route, {
        active: false,
        section: 'guest-collector',
        message: '',
        activeSection: null,
        expiresAt: null,
      }),
    );
    await page.route('**/api/guest-collect/parity-collector', (route) => {
      if (route.request().method() === 'GET') {
        return fulfillJson(route, {
          partner1Name: 'Joseph',
          partner2Name: 'Gabriela',
        });
      }
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
        submissions.push(body);
        return fulfillJson(route, { success: true, guestId: 4242 }, 201);
      }
      return route.fallback();
    });

    const response = await page.goto('/collect/parity-collector', { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), 'Guest collector response').toBeTruthy();

    await page.getByLabel(/Full Name/i).fill('Taylor Morgan');
    await page.getByLabel(/Street Address/i).fill('456 Garden Ave');
    await page.getByLabel(/Apt \/ Unit/i).fill('Unit 8');
    await page.getByLabel(/^City$/i).fill('Garfield');
    await page.getByLabel(/^State$/i).fill('NJ');
    await page.getByLabel(/^ZIP$/i).fill('07026');
    await page.getByLabel(/Email Address/i).fill('taylor@example.com');
    await page.getByLabel(/Phone Number/i).fill('(555) 010-2200');
    await page.getByRole('button', { name: /Send My Info/i }).click();

    await expect(page.getByText(/Got it, thank you/i)).toBeVisible();
    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject({
      name: 'Taylor Morgan',
      address: '456 Garden Ave',
      aptUnit: 'Unit 8',
      guestCity: 'Garfield',
      guestState: 'NJ',
      guestZip: '07026',
      email: 'taylor@example.com',
      phone: '(555) 010-2200',
    });
    await expectNoPageHorizontalOverflow(page, 'Guest collector separated address form');
  });

  test.describe('signed-in parity flows', () => {
    test.use({ storageState: hasAuthState ? authStatePath : undefined });

    test.beforeEach(async ({ page }) => {
      test.skip(
        !hasAuthState,
        'Missing .auth/user.json. Run: npx.cmd playwright codegen --save-storage=.auth/user.json https://aidowedding.net',
      );
      await page.addInitScript(() => {
        window.localStorage.setItem('aido_e2e_auth_bypass', 'true');
      });
      await mockSignedInAppBasics(page);
    });

    test('calendar gathers app deadlines and exposes reminder settings', async ({ page }) => {
      await mockCalendarSources(page);

      const response = await page.goto('/calendar', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), 'Calendar response').toBeTruthy();
      await expectAppReady(page, /wedding calendar|every date|reminder settings/i);

      await expect(page.locator('body')).toContainText(/Email reminders are on 7 days before checklist deadlines/i);
      await expect(page.locator('body')).toContainText(/Book engagement session outfits/i);
      await expect(page.locator('body')).toContainText(/Petal Studio payment due/i);
      await expect(page.locator('body')).toContainText(/Lumen & Lace Photo follow-up/i);
      await expect(page.locator('body')).toContainText(/A\.IDO Hotel Block block cutoff/i);
      await expect(page.locator('body')).toContainText(/Golden hour portraits/i);
      await expect(page.getByRole('link', { name: /manage reminders/i })).toHaveAttribute('href', '/settings');
      await expectNoPageHorizontalOverflow(page, 'Calendar app page');
    });

    test('website editor mobile copy saves to the public phone site', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const website = await mockWebsiteEditorApis(page);
      const mobileWelcomeCopy = 'Mobile editor copy appears on the guest website.';

      const response = await page.goto('/website-editor', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), 'Website editor response').toBeTruthy();
      await expectAppReady(page, /website editor|mobile website control center|preview|publish/i);

      await page.getByRole('button', { name: /^welcome$/i }).click();
      await page.getByTestId('website-copy-welcome').fill(mobileWelcomeCopy);
      await expect
        .poll(
          () => website.updateBodies.some((body) =>
            (body.customText as Record<string, string> | undefined)?.welcome === mobileWelcomeCopy),
          { message: 'Website editor mobile copy autosaved', timeout: 10_000 },
        )
        .toBe(true);

      const publicResponse = await page.goto('/parity-editor', { waitUntil: 'domcontentloaded' });
      expect(publicResponse?.ok(), 'Public website welcome response').toBeTruthy();
      await expect(page.locator('body')).toContainText(mobileWelcomeCopy);
      await expectNoPageHorizontalOverflow(page, 'Published welcome copy from editor');
    });

    test('website editor FAQ questions publish to the public phone site', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const website = await mockWebsiteEditorApis(page);
      const question = 'Can guests bring children?';
      const answer = 'Please keep the reception adults-only after dinner.';

      const response = await page.goto('/website-editor', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), 'Website editor FAQ response').toBeTruthy();
      await expectAppReady(page, /website editor|mobile website control center|preview|publish/i);

      await page.locator('aside').getByRole('button', { name: /^FAQ$/i }).click();
      await expect(page.locator('body')).toContainText(/FAQ Questions/i);
      await page.getByTestId('website-faq-question-0').fill(question);
      await page.getByTestId('website-faq-answer-0').fill(answer);

      await expect
        .poll(
          () => website.updateBodies.some((body) => {
            const rawItems = (body.customText as Record<string, string> | undefined)?.faq_items_json;
            return Boolean(rawItems?.includes(question) && rawItems.includes(answer));
          }),
          { message: 'Website editor FAQ autosaved', timeout: 10_000 },
        )
        .toBe(true);

      const publicResponse = await page.goto('/parity-editor/faq', { waitUntil: 'domcontentloaded' });
      expect(publicResponse?.ok(), 'Public website FAQ response').toBeTruthy();
      await expect(page.locator('body')).toContainText(/Can guests bring children|adults-only/i);
      await expectNoPageHorizontalOverflow(page, 'Published FAQ from editor');
    });

    test('website editor schedule events publish to the public phone site', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const website = await mockWebsiteEditorApis(page);

      const response = await page.goto('/website-editor', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), 'Website editor schedule response').toBeTruthy();
      await expectAppReady(page, /website editor|mobile website control center|preview|publish/i);

      await page.locator('aside').getByRole('button', { name: /^Schedule$/i }).click();
      await expect(page.locator('body')).toContainText(/Schedule Events/i);
      await page.getByTestId('website-schedule-ceremony-time').fill('16:30');
      await page.getByTestId('website-schedule-ceremony-label').fill('Garden ceremony');
      await page.getByTestId('website-schedule-cocktail-time').fill('17:15');
      await page.getByTestId('website-schedule-cocktail-label').fill('Patio cocktail hour');
      await page.getByTestId('website-schedule-reception-time').fill('18:45');
      await page.getByTestId('website-schedule-reception-label').fill('Dinner and dancing');

      await expect
        .poll(
          () => website.updateBodies.some((body) => {
            const customText = body.customText as Record<string, string> | undefined;
            return customText?._scheduleCeremonyTime === '16:30' &&
              customText._scheduleCeremonyLabel === 'Garden ceremony' &&
              customText._scheduleCocktailTime === '17:15' &&
              customText._scheduleCocktailLabel === 'Patio cocktail hour' &&
              customText._scheduleReceptionTime === '18:45' &&
              customText._scheduleReceptionLabel === 'Dinner and dancing';
          }),
          { message: 'Website editor schedule autosaved', timeout: 10_000 },
        )
        .toBe(true);

      const publicResponse = await page.goto('/parity-editor/schedule', { waitUntil: 'domcontentloaded' });
      expect(publicResponse?.ok(), 'Public website schedule response').toBeTruthy();
      await expect(page.locator('body')).toContainText(/Garden ceremony|Patio cocktail hour|Dinner and dancing/i);
      await expect(page.locator('body')).toContainText(/4:30 PM|5:15 PM|6:45 PM/i);
      await expectNoPageHorizontalOverflow(page, 'Published schedule from editor');
    });

    test('website editor password protects and unlocks the public phone site', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const website = await mockWebsiteEditorApis(page);

      const response = await page.goto('/website-editor', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), 'Website editor password response').toBeTruthy();
      await expectAppReady(page, /website editor|mobile website control center|preview|publish/i);

      await page.getByTestId('website-open-publish-settings').click();
      await expect(page.locator('body')).toContainText(/Password Protection/i);
      await page.getByTestId('website-password-input').fill('garden-party');
      await page.getByTestId('website-password-save').click();

      await expect
        .poll(
          () => website.updateBodies.some((body) => body.password === 'garden-party'),
          { message: 'Website password saved from editor', timeout: 10_000 },
        )
        .toBe(true);

      const gatedResponse = await page.goto('/parity-editor', { waitUntil: 'domcontentloaded' });
      expect(gatedResponse?.ok(), 'Password gate page response').toBeTruthy();
      await expect(page.locator('body')).toContainText(/Private Wedding|password protected/i);
      await expectNoPageHorizontalOverflow(page, 'Public password gate');

      await page.getByPlaceholder('Password').fill('wrong-password');
      await page.getByRole('button', { name: /view site/i }).click();
      await expect(page.locator('body')).toContainText(/Incorrect password/i);

      await page.getByPlaceholder('Password').fill('garden-party');
      await page.getByRole('button', { name: /view site/i }).click();
      await expect(page.locator('body')).toContainText(/Original app welcome copy|Gabriela|Joseph/i);

      const editorAgain = await page.goto('/website-editor', { waitUntil: 'domcontentloaded' });
      expect(editorAgain?.ok(), 'Website editor password removal response').toBeTruthy();
      await page.getByTestId('website-open-publish-settings').click();
      await expect(page.getByTestId('website-password-remove')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('website-password-remove').click();
      await expect
        .poll(
          () => website.updateBodies.some((body) => body.password === null),
          { message: 'Website password removed from editor', timeout: 10_000 },
        )
        .toBe(true);

      const ungatedResponse = await page.goto('/parity-editor', { waitUntil: 'domcontentloaded' });
      expect(ungatedResponse?.ok(), 'Public website after password removal response').toBeTruthy();
      await expect(page.locator('body')).toContainText(/Original app welcome copy|Gabriela|Joseph/i);
      await expect(page.locator('body')).not.toContainText(/Private Wedding/i);
      await expectNoPageHorizontalOverflow(page, 'Public website after password removal');
    });

    test('website editor publish toggle controls public guest access', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const website = await mockWebsiteEditorApis(page);

      const response = await page.goto('/website-editor', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), 'Website editor publish response').toBeTruthy();
      await expectAppReady(page, /website editor|mobile website control center|preview|publish/i);

      await page.getByTestId('website-open-publish-settings').click();
      await expect(page.locator('body')).toContainText(/Website Visibility|Live/i);
      await page.getByTestId('website-publish-toggle').click();

      await expect
        .poll(
          () => website.publishBodies.some((body) => body.published === false),
          { message: 'Website unpublished from editor', timeout: 10_000 },
        )
        .toBe(true);

      const draftResponse = await page.goto('/parity-editor', { waitUntil: 'domcontentloaded' });
      expect(draftResponse?.ok(), 'Draft public website error shell response').toBeTruthy();
      await expect(page.locator('body')).toContainText(/doesn't exist or hasn't been published/i);

      const editorAgain = await page.goto('/website-editor', { waitUntil: 'domcontentloaded' });
      expect(editorAgain?.ok(), 'Website editor republish response').toBeTruthy();
      await page.getByTestId('website-open-publish-settings').click();
      await expect(page.locator('body')).toContainText(/Website Visibility|Not published|Live/i);
      await page.getByTestId('website-publish-toggle').click();
      await expect
        .poll(
          () => website.publishBodies.some((body) => body.published === true),
          { message: 'Website republished from editor', timeout: 10_000 },
        )
        .toBe(true);

      const liveResponse = await page.goto('/parity-editor', { waitUntil: 'domcontentloaded' });
      expect(liveResponse?.ok(), 'Republished public website response').toBeTruthy();
      await expect(page.locator('body')).toContainText(/Original app welcome copy|Gabriela|Joseph/i);
      await expectNoPageHorizontalOverflow(page, 'Republished public website');
    });

    test('website editor gallery uploads publish to the public phone site', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const website = await mockWebsiteEditorApis(page);
      const caption = 'Sunset terrace portrait';

      const response = await page.goto('/website-editor', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), 'Website editor gallery response').toBeTruthy();
      await expectAppReady(page, /website editor|mobile website control center|preview|publish/i);

      await page.locator('aside').getByRole('button', { name: /^Gallery$/i }).click();
      await expect(page.locator('body')).toContainText(/Gallery/i);
      await page.getByTestId('website-gallery-upload').setInputFiles({
        name: 'terrace-portrait.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fake gallery image data'),
      });

      await expect
        .poll(() => website.uploadedObjects.length, { message: 'Gallery image uploaded to mock storage', timeout: 10_000 })
        .toBe(1);
      await expect(page.getByTestId('website-gallery-caption-1')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('website-gallery-caption-1').fill(caption);

      await expect
        .poll(
          () => website.updateBodies.some((body) => {
            const galleryImages = body.galleryImages as Array<{ url?: string; caption?: string; order?: number }> | undefined;
            return Boolean(galleryImages?.some((image) =>
              image.url?.includes('/objects/website-gallery/terrace-portrait.png') &&
              image.caption === caption &&
              image.order === 1,
            ));
          }),
          { message: 'Website gallery image and caption saved', timeout: 10_000 },
        )
        .toBe(true);

      const publicResponse = await page.goto('/parity-editor/gallery', { waitUntil: 'domcontentloaded' });
      expect(publicResponse?.ok(), 'Public website gallery response').toBeTruthy();
      await expect(page.locator('body')).toContainText(/Sunset terrace portrait|Moments from us and our guests/i);
      await expectNoPageHorizontalOverflow(page, 'Published gallery upload from editor');
    });

    test('website editor home photo publishes as the public phone hero', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const website = await mockWebsiteEditorApis(page);

      const response = await page.goto('/website-editor', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), 'Website editor hero photo response').toBeTruthy();
      await expectAppReady(page, /website editor|mobile website control center|preview|publish/i);

      await page.getByTestId('website-hero-upload').setInputFiles({
        name: 'hero-home.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fake hero image data'),
      });
      await expect(page.getByRole('dialog')).toContainText(/Crop your photo/i);
      await page.getByTestId('image-crop-use-original').click();

      await expect
        .poll(() => website.uploadedObjects.length, { message: 'Hero image uploaded to mock storage', timeout: 10_000 })
        .toBe(1);
      await expect
        .poll(
          () => website.updateBodies.some((body) =>
            typeof body.heroImage === 'string' &&
            body.heroImage.includes('/objects/website-gallery/hero-home.png')),
          { message: 'Website hero image saved', timeout: 10_000 },
        )
        .toBe(true);

      const publicResponse = await page.goto('/parity-editor', { waitUntil: 'domcontentloaded' });
      expect(publicResponse?.ok(), 'Public website hero response').toBeTruthy();
      await expect(page.locator('body')).toContainText(/Gabriela|Joseph|Original app welcome copy/i);
      await expect
        .poll(
          () => website.mediaRequests.some((url) => url.includes('hero-home.png')),
          { message: 'Public hero requested uploaded media', timeout: 10_000 },
        )
        .toBe(true);
      await expectNoPageHorizontalOverflow(page, 'Published home hero from editor');
    });

    test('public photo drop uploads land in the app approval queue', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const photoDrop = await mockGuestPhotoDropApis(page);

      const publicResponse = await page.goto('/photo-drop/parity-wedding', { waitUntil: 'domcontentloaded' });
      expect(publicResponse?.ok(), 'Public photo drop response').toBeTruthy();
      await expect(page.locator('body')).toContainText(/Guest Photo Drop|photo.*left|Upload Photos/i);

      await page.locator('input[type="file"][multiple]').setInputFiles({
        name: 'dance-floor.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fake image data'),
      });
      await page.getByLabel(/your name/i).fill('Casey Guest');
      await page.getByLabel(/add a caption/i).fill('Dance floor moment');
      await page.getByRole('button', { name: /upload photos/i }).click();
      await expect(page.locator('body')).toContainText(/photos were sent|thank you/i, { timeout: 10_000 });
      await expect
        .poll(() => photoDrop.uploads.length, { message: 'Guest photo upload completed', timeout: 10_000 })
        .toBe(1);
      expect(photoDrop.uploadedObjects.length).toBe(1);
      expect(photoDrop.uploads[0]).toMatchObject({
        guestName: 'Casey Guest',
        caption: 'Dance floor moment',
        status: 'pending',
      });

      const appResponse = await page.goto('/guest-photo-drop', { waitUntil: 'domcontentloaded' });
      expect(appResponse?.ok(), 'Guest Photo Drop app response').toBeTruthy();
      await expectAppReady(page, /Guest Photo Drop|Needs Review|Casey Guest/i);
      await expect(page.locator('body')).toContainText(/Dance floor moment|pending/i);

      await page.getByRole('button', { name: /approve photo/i }).click();
      await expect
        .poll(() => photoDrop.uploads[0]?.status, { message: 'Guest photo approved in app', timeout: 10_000 })
        .toBe('approved');
      await expect(page.locator('body')).toContainText(/Reviewed Photos|approved/i);
      await expectNoPageHorizontalOverflow(page, 'Guest Photo Drop approval');
    });

    test('registry app page syncs gift links to the public phone site', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const registry = await mockRegistryWebsiteApis(page);
      const title = 'Gift Details';
      const note = 'We are registered at Zola and a small honeymoon fund.';

      const response = await page.goto('/registry', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), 'Registry app response').toBeTruthy();
      await expectAppReady(page, /registry|wedding website|gift/i);

      await page.getByLabel(/section title/i).fill(title);
      await page.getByLabel(/registry message/i).fill(note);
      await page.getByRole('button', { name: /add registry link/i }).click();
      await page.getByLabel(/button label/i).fill('Zola Registry');
      await page.getByLabel(/registry url/i).fill('zola.com/parity-couple');
      await page.getByRole('button', { name: /save registry/i }).click();

      await expect
        .poll(
          () => registry.updateBodies.some((body) => {
            const customText = body.customText as Record<string, string> | undefined;
            return customText?.registry_title === title &&
              customText.registry === note &&
              customText._registryLinks?.includes('https://zola.com/parity-couple');
          }),
          { message: 'Registry settings saved to website record', timeout: 10_000 },
        )
        .toBe(true);

      const publicResponse = await page.goto('/parity-registry/registry', { waitUntil: 'domcontentloaded' });
      expect(publicResponse?.ok(), 'Public registry response').toBeTruthy();
      await expect(page.locator('body')).toContainText(/Gift Details|Zola Registry|honeymoon fund/i);
      await expect(page.getByRole('link', { name: /zola registry/i })).toHaveAttribute('href', 'https://zola.com/parity-couple');
      await expectNoPageHorizontalOverflow(page, 'Public registry from app');
    });

    test('hotel block app details appear on the public travel page', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const hotelBlocks = await mockHotelBlockApis(page);

      const response = await page.goto('/hotels', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), 'Hotels app response').toBeTruthy();
      await expectAppReady(page, /hotel|block|room|booking/i);

      await page.getByRole('button', { name: /add hotel/i }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(/add hotel block/i);
      await dialog.getByPlaceholder(/marriott newark/i).fill('Harbor House Suites');
      await dialog.getByPlaceholder(/123 main st/i).fill('88 River Road');
      await dialog.getByPlaceholder('Newark', { exact: true }).fill('Garfield');
      await dialog.getByPlaceholder(/^NJ$/i).fill('NJ');
      await dialog.getByPlaceholder(/07101/i).fill('07026');
      await dialog.getByPlaceholder(/\(555\) 000-0000/i).fill('(555) 777-1188');
      await dialog.getByPlaceholder('https://...').fill('https://hotel.example/book');
      await dialog.getByPlaceholder(/WEDDING2025/i).fill('AIDO2027');
      await dialog.getByPlaceholder(/Smith-Johnson Wedding/i).fill('Gabriela & Joseph Wedding');
      await dialog.locator('input[type="date"]').nth(0).fill('2027-03-15');
      await dialog.locator('input[type="date"]').nth(1).fill('2027-04-23');
      await dialog.locator('input[type="date"]').nth(2).fill('2027-04-25');
      await dialog.getByPlaceholder(/189\.00/i).fill('219');
      await dialog.getByPlaceholder(/^20$/i).fill('18');
      await dialog.getByPlaceholder(/1\.2 mi from venue/i).fill('0.4 mi from venue');
      await dialog.getByPlaceholder(/Shuttle available/i).fill('Shuttle pickup is by the lobby.');
      await dialog.getByRole('button', { name: /add hotel block/i }).click();

      await expect
        .poll(() => hotelBlocks.hotels.length, { message: 'Hotel block created in app', timeout: 10_000 })
        .toBe(1);
      expect(hotelBlocks.createdBodies[0]).toMatchObject({
        hotelName: 'Harbor House Suites',
        bookingLink: 'https://hotel.example/book',
        discountCode: 'AIDO2027',
      });
      await expect(page.locator('body')).toContainText(/Harbor House Suites|AIDO2027|0\.4 mi from venue/i);

      const publicResponse = await page.goto('/parity-hotels/travel', { waitUntil: 'domcontentloaded' });
      expect(publicResponse?.ok(), 'Public travel response').toBeTruthy();
      await expect(page.locator('body')).toContainText(/Harbor House Suites|AIDO2027|Gabriela & Joseph Wedding|Book early/i);
      await expect(page.getByRole('link', { name: /book hotel room/i })).toHaveAttribute('href', 'https://hotel.example/book');
      await expectNoPageHorizontalOverflow(page, 'Public hotel block from app');
    });

    test('wedding party app members appear on the public phone site', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const party = await mockWeddingPartyWebsiteApis(page);

      const response = await page.goto('/wedding-party', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), 'Wedding Party app response').toBeTruthy();
      await expectAppReady(page, /Wedding Party|Add Member|wedding party/i);

      await page.getByRole('button', { name: /add member/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(/Add Wedding Party Member/i);
      await dialog.getByPlaceholder('Jane Smith').fill('Sofia Alvarez');
      await dialog.locator('textarea').fill('Keeps the ceremony crew organized.');
      await dialog.getByRole('button', { name: /^Add Member$/i }).click();

      await expect
        .poll(() => party.members.length, { message: 'Wedding party member created in app', timeout: 10_000 })
        .toBe(1);
      expect(party.createdBodies[0]).toMatchObject({
        name: 'Sofia Alvarez',
        role: 'Bridesmaid',
        side: 'bride',
      });
      await expect(page.locator('body')).toContainText(/Sofia Alvarez|Bridesmaid/i);

      const publicResponse = await page.goto('/parity-party/wedding-party', { waitUntil: 'domcontentloaded' });
      expect(publicResponse?.ok(), 'Public wedding party response').toBeTruthy();
      await expect(page.locator('body')).toContainText(/Sofia Alvarez|Bridesmaid|The people standing with us/i);
      await expectNoPageHorizontalOverflow(page, 'Public wedding party from app');
    });

    test('contract analysis can become a vendor message draft', async ({ page }) => {
      await page.route('**/api/contracts', (route) => {
        if (route.request().method() === 'GET') {
          return fulfillJson(route, [{
            id: 501,
            vendorId: vendor.id,
            vendorName: vendor.name,
            hotelBlockId: null,
            hotelName: null,
            fileName: 'Lumen & Lace Agreement',
            fileSize: 48210,
            createdAt: now,
            analysis: contractAnalysis,
          }]);
        }
        return route.fallback();
      });
      await page.route('**/api/contracts/501/negotiate', (route) =>
        fulfillJson(route, {
          negotiationEmail: 'Hi Maya, could we clarify the overtime fee, approval process, and cancellation language before signing?',
        }));
      const sentBodies = await mockMessagingSend(page);

      const response = await page.goto('/contracts', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), 'Contracts response').toBeTruthy();
      await expectAppReady(page, /contract|analyze|upload/i);

      await page.getByRole('button', { name: /view ai analysis/i }).click();
      await expect(page.locator('body')).toContainText(/Uncapped overtime fees|Payment Terms|Missing Clauses/i);
      await page.getByRole('button', { name: /draft negotiation email/i }).click();
      await expect(page.getByRole('textbox').filter({ hasText: /overtime fee/i })).toBeVisible({ timeout: 10_000 });
      await page.getByRole('button', { name: /send to vendor/i }).click();

      await expect(page).toHaveURL(/\/vendors\?vendorId=77&tab=messages/);
      await expect(page.getByRole('dialog')).toContainText(vendor.name, { timeout: 15_000 });
      await expect(page.getByRole('textbox').filter({ hasText: /overtime fee/i })).toBeVisible();

      await page.getByRole('button', { name: /^send$/i }).click();
      await expect
        .poll(() => sentBodies.length, { message: 'Vendor message was sent', timeout: 10_000 })
        .toBe(1);
      expect(sentBodies[0]).toMatchObject({
        body: expect.stringContaining('overtime fee'),
        subject: expect.stringContaining('Gabriela and Joseph'),
      });
    });

    test('vendor messages support AI reply drafting without touching live data', async ({ page }) => {
      await mockMessagingSend(page);

      const response = await page.goto(`/vendors?management=messages&vendorId=${vendor.id}`, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), 'Vendor messages response').toBeTruthy();
      await expectAppReady(page, /Messages|Conversation|Lumen & Lace Photo/i);

      await expect(page.locator('body')).toContainText(/Could you clarify the overtime fee/i);
      await page.getByRole('button', { name: /ai suggest/i }).click();
      await expect(page.getByRole('textbox').filter({ hasText: /overtime rate and meal-break terms/i })).toBeVisible({ timeout: 10_000 });

      if (await visible(page.getByTestId('input-cc-email'))) {
        await page.getByTestId('input-cc-email').fill('planner@example.com');
        await page.getByTestId('input-cc-email').press('Enter');
        await expect(page.getByTestId('cc-chip-planner@example.com')).toBeVisible();
      }
    });

    test('contract upload can sync into the document library without live data', async ({ page }) => {
      const synced = await mockContractDocumentSync(page);

      const response = await page.goto('/documents', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), 'Documents response').toBeTruthy();
      await expectAppReady(page, /document library|contracts/i);

      await page.getByRole('tab', { name: /contract analyzer/i }).click();
      await page.locator('#contract-file-upload').setInputFiles({
        name: 'lumen-lace-agreement.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Lumen & Lace agreement. Final payment due April 10, 2027.'),
      });
      await expect(page.locator('body')).toContainText(/selected file|lumen-lace-agreement/i);
      await page.getByTestId('select-contract-vendor').click();
      await page.getByRole('option', { name: /Vendor: Lumen & Lace Photo/i }).click();
      await page.getByRole('checkbox', { name: /sync to document library/i }).click();
      await page.getByRole('button', { name: /analyze/i }).click();

      await expect
        .poll(() => synced.documents.length, { message: 'Contract synced into document library', timeout: 10_000 })
        .toBe(1);
      await expect
        .poll(() => synced.contracts.length, { message: 'Contract saved in analyzer list', timeout: 10_000 })
        .toBe(1);

      await page.getByRole('tab', { name: /document library/i }).click();
      await expect(page.locator('body')).toContainText(/Lumen & Lace Agreement/i);
      await expect(page.locator('body')).toContainText(/Contracts/i);
      await expect(page.locator('body')).toContainText(/Contract/i);
      await expect(page.locator('body')).toContainText(/Lumen & Lace Photo/i);
      await expect(page.locator('body')).toContainText(/Review the cancellation and overtime language/i);
      await expectNoPageHorizontalOverflow(page, 'Document Library contract sync');
    });

    test('guest list can send RSVP reminders without live data', async ({ page }) => {
      const reminders = await mockGuestReminderApis(page);

      const response = await page.goto('/guests', { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), 'Guest list response').toBeTruthy();
      await expectAppReady(page, /guest list|invitations|rsvp/i);
      await expect(page.locator('body')).toContainText(/Jordan Rivera/i);
      await expect(page.locator('body')).toContainText(/Send RSVP Reminders|Reminders/i);

      await page.getByRole('button', { name: /^(send rsvp reminders|reminders)\s+\d+$/i }).click();
      await expect
        .poll(() => reminders.reminderSends.length, { message: 'RSVP reminder was sent', timeout: 10_000 })
        .toBe(1);
      expect(reminders.reminderSends).toEqual([rsvpGuest.id]);
      await expect(page.locator('body')).toContainText(/Reminders sent|RSVP reminder email/i);
      await expectNoPageHorizontalOverflow(page, 'Guest reminder send');
    });
  });
});
