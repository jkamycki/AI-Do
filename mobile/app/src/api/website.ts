import { mobileAuthJson } from './mobileAuth';

export type MobileWebsiteRecord = {
  customText?: Record<string, string>;
  id: number;
  lastUpdated?: string;
  passwordEnabled?: boolean;
  published?: boolean;
  sectionsEnabled?: Record<string, boolean>;
  slug?: string;
};

export async function getMobileWebsite() {
  return mobileAuthJson<MobileWebsiteRecord>('/api/website/me');
}

export async function createMobileWebsite() {
  return mobileAuthJson<MobileWebsiteRecord>('/api/website/create', { method: 'POST' });
}

export async function saveMobileWebsiteQuickUpdate(payload: {
  customText?: Record<string, string>;
  sectionsEnabled?: Record<string, boolean>;
}) {
  return mobileAuthJson<MobileWebsiteRecord>('/api/website/update', {
    body: JSON.stringify(payload),
    method: 'PUT',
  });
}

export async function publishMobileWebsite(published: boolean) {
  return mobileAuthJson<MobileWebsiteRecord>('/api/website/publish', {
    body: JSON.stringify({ published }),
    method: 'PUT',
  });
}

export async function saveMobileWebsiteSlug(slug: string) {
  return mobileAuthJson<MobileWebsiteRecord>('/api/website/slug', {
    body: JSON.stringify({ slug }),
    method: 'PUT',
  });
}
