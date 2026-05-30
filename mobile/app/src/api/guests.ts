import type { Guest, RsvpStatus } from '../types';
import { mobileAuthFetch } from './mobileAuth';

type BackendGuest = {
  email?: string | null;
  id: number | string;
  invitationStatus?: string | null;
  name?: string | null;
  rsvpReminderStatus?: string | null;
  rsvpStatus?: string | null;
  saveTheDateStatus?: string | null;
  mealChoice?: string | null;
  plusOne?: boolean | null;
  plusOneName?: string | null;
  plusOneStatus?: string | null;
  guestGroup?: string | null;
  tableAssignment?: string | null;
};

type GuestSyncResult = {
  guest?: Guest;
  synced: boolean;
};

const rsvpToBackend: Record<RsvpStatus, string> = {
  Confirmed: 'attending',
  Declined: 'declined',
  Pending: 'pending',
};

function backendRsvpToMobile(status?: string | null): RsvpStatus {
  if (status === 'attending' || status === 'accepted' || status === 'yes') return 'Confirmed';
  if (status === 'declined' || status === 'no') return 'Declined';
  return 'Pending';
}

function isBackendId(id: string) {
  return /^\d+$/.test(id);
}

function guestPayload(guest: Guest) {
  return {
    email: guest.email?.trim() || null,
    guestGroup: guest.role.trim() || null,
    invitationStatus: 'pending',
    mealChoice: guest.mealPreference.trim() || null,
    name: guest.name.trim(),
    plusOne: guest.plusOneStatus === 'named' || guest.plusOneStatus === 'name_tbd',
    plusOneName: guest.plusOneName?.trim() || null,
    plusOneStatus: guest.plusOneStatus || (guest.plusOne ? 'name_tbd' : 'none'),
    rsvpStatus: rsvpToBackend[guest.rsvp],
    tableAssignment: guest.table.trim() && guest.table !== 'No table' ? guest.table.trim() : null,
  };
}

function toMobileGuest(guest: BackendGuest, fallback?: Guest): Guest {
  return {
    email: guest.email?.trim() || fallback?.email || '',
    id: String(guest.id ?? fallback?.id ?? `mobile-${Date.now()}`),
    invitationStatus: guest.invitationStatus || fallback?.invitationStatus || 'pending',
    invitationStyle: fallback?.invitationStyle ?? 'cream',
    mealPreference: guest.mealChoice?.trim() || fallback?.mealPreference || 'Guest',
    name: guest.name?.trim() || fallback?.name || 'Guest',
    plusOne: Boolean(guest.plusOne ?? fallback?.plusOne),
    plusOneName: guest.plusOneName?.trim() || fallback?.plusOneName || '',
    plusOneStatus: guest.plusOneStatus || fallback?.plusOneStatus || (guest.plusOne ? 'name_tbd' : 'none'),
    rsvpReminderStatus: guest.rsvpReminderStatus || fallback?.rsvpReminderStatus || 'not_sent',
    role: guest.guestGroup?.trim() || fallback?.role || 'Guest',
    rsvp: backendRsvpToMobile(guest.rsvpStatus) || fallback?.rsvp || 'Pending',
    saveTheDateStatus: guest.saveTheDateStatus || fallback?.saveTheDateStatus || 'not_sent',
    table: guest.tableAssignment?.trim() || fallback?.table || 'No table',
  };
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.error || body.message || 'Guest sync failed.';
  } catch {
    return 'Guest sync failed.';
  }
}

export async function createMobileGuest(guest: Guest): Promise<GuestSyncResult> {
  const response = await mobileAuthFetch('/api/guests?force=true', {
    body: JSON.stringify(guestPayload(guest)),
    method: 'POST',
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { guest: toMobileGuest((await response.json()) as BackendGuest, guest), synced: true };
}

export async function updateMobileGuest(guest: Guest): Promise<GuestSyncResult> {
  if (!isBackendId(guest.id)) return { synced: false };
  const response = await mobileAuthFetch(`/api/guests/${guest.id}`, {
    body: JSON.stringify(guestPayload(guest)),
    method: 'PUT',
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { guest: toMobileGuest((await response.json()) as BackendGuest, guest), synced: true };
}

export async function deleteMobileGuest(guestId: string): Promise<{ synced: boolean }> {
  if (!isBackendId(guestId)) return { synced: false };
  const response = await mobileAuthFetch(`/api/guests/${guestId}`, { method: 'DELETE' });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { synced: true };
}
