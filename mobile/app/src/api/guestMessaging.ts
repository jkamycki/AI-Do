import { mobileAuthJson } from './mobileAuth';

type ApiGuest = {
  email?: string | null;
  id: number;
  invitationStatus?: string | null;
  name: string;
  rsvpReminderStatus?: string | null;
  rsvpStatus?: string | null;
  saveTheDateStatus?: string | null;
};

type GuestsResponse = {
  guests: ApiGuest[];
};

type RsvpReminderResponse = {
  emailSent: boolean;
  previewUrl?: string;
  rsvpUrl: string;
};

type GuestSendResponse = {
  emailSent: boolean;
  previewUrl?: string;
  rsvpUrl?: string;
  saveTheDateUrl?: string;
};

type GuestCampaignResult = {
  attempted: number;
  delivered: number;
  markedSent: number;
  links: Array<{ guestId: number; name: string; url: string }>;
};

async function sendGuestCampaign({
  endpoint,
  isEligible,
}: {
  endpoint: (guestId: number) => string;
  isEligible: (guest: ApiGuest) => boolean;
}): Promise<GuestCampaignResult> {
  const { guests } = await mobileAuthJson<GuestsResponse>('/api/guests');
  const targetGuests = guests.filter(isEligible);

  if (!targetGuests.length) {
    return { attempted: 0, delivered: 0, markedSent: 0, links: [] };
  }

  let delivered = 0;
  let markedSent = 0;
  const links: GuestCampaignResult['links'] = [];

  for (const guest of targetGuests) {
    const result = await mobileAuthJson<GuestSendResponse>(endpoint(guest.id), { method: 'POST' });
    if (result.emailSent) delivered += 1;
    else markedSent += 1;
    const url = result.rsvpUrl ?? result.saveTheDateUrl ?? result.previewUrl;
    if (url) links.push({ guestId: guest.id, name: guest.name, url });
  }

  return { attempted: targetGuests.length, delivered, markedSent, links };
}

export async function sendPendingRsvpReminders() {
  return sendGuestCampaign({
    endpoint: (guestId) => `/api/guests/${guestId}/send-rsvp-reminder`,
    isEligible: (guest) => {
      const invitationSent = (guest.invitationStatus ?? 'pending') === 'sent';
      const pending = (guest.rsvpStatus ?? 'pending') === 'pending';
      const notAlreadySent = (guest.rsvpReminderStatus ?? 'not_sent') !== 'sent';
      return invitationSent && pending && notAlreadySent;
    },
  }) as Promise<GuestCampaignResult & { links: Array<{ guestId: number; name: string; url: string }> }>;
}

export async function sendSaveTheDates() {
  return sendGuestCampaign({
    endpoint: (guestId) => `/api/guests/${guestId}/send-save-the-date`,
    isEligible: (guest) => (guest.saveTheDateStatus ?? 'not_sent') === 'not_sent',
  });
}

export async function sendRsvpInvitations() {
  return sendGuestCampaign({
    endpoint: (guestId) => `/api/guests/${guestId}/send-rsvp`,
    isEligible: (guest) => (guest.invitationStatus ?? 'pending') === 'pending',
  });
}

export async function sendSingleRsvpReminder(guestId: number) {
  return mobileAuthJson<RsvpReminderResponse>(`/api/guests/${guestId}/send-rsvp-reminder`, {
    method: 'POST',
  });
}
