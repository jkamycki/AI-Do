import type { Guest, RsvpStatus } from '../types';
import { mobileAuthFetch } from './mobileAuth';

type BackendGuest = {
  id: number | string;
  name?: string | null;
  rsvpStatus?: string | null;
  mealChoice?: string | null;
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
    guestGroup: guest.role.trim() || null,
    invitationStatus: 'pending',
    mealChoice: guest.mealPreference.trim() || null,
    name: guest.name.trim(),
    rsvpStatus: rsvpToBackend[guest.rsvp],
    tableAssignment: guest.table.trim() && guest.table !== 'No table' ? guest.table.trim() : null,
  };
}

function toMobileGuest(guest: BackendGuest, fallback?: Guest): Guest {
  return {
    id: String(guest.id ?? fallback?.id ?? `mobile-${Date.now()}`),
    invitationStyle: fallback?.invitationStyle ?? 'cream',
    mealPreference: guest.mealChoice?.trim() || fallback?.mealPreference || 'Guest',
    name: guest.name?.trim() || fallback?.name || 'Guest',
    role: guest.guestGroup?.trim() || fallback?.role || 'Guest',
    rsvp: backendRsvpToMobile(guest.rsvpStatus) || fallback?.rsvp || 'Pending',
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
