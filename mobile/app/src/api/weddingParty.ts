import type { WeddingPartyMember } from '../types';
import { mobileAuthFetch } from './mobileAuth';

type BackendWeddingPartyMember = {
  id: number | string;
  name?: string | null;
  notes?: string | null;
  outfitDetails?: string | null;
  phone?: string | null;
  role?: string | null;
  side?: string | null;
};

type WeddingPartySyncResult = {
  member?: WeddingPartyMember;
  synced: boolean;
};

function isBackendId(id: string) {
  return /^\d+$/.test(id);
}

function sideToBackend(side: WeddingPartyMember['side']) {
  return side === 'Groom' ? 'groom' : side === 'Shared' ? 'shared' : 'bride';
}

function sideToMobile(side?: string | null): WeddingPartyMember['side'] {
  if (side === 'groom') return 'Groom';
  if (side === 'shared') return 'Shared';
  return 'Bride';
}

function attireToMobile(outfitDetails?: string | null, fallback?: WeddingPartyMember['attireStatus']): WeddingPartyMember['attireStatus'] {
  if (outfitDetails === 'Complete') return 'Complete';
  if (outfitDetails) return 'In Progress';
  return fallback || 'Not Started';
}

function partyPayload(member: WeddingPartyMember) {
  return {
    name: member.name.trim(),
    notes: member.tasks.join(', ') || null,
    outfitDetails: member.attireStatus === 'Not Started' ? null : member.attireStatus,
    phone: member.phone.trim() || null,
    role: member.role.trim(),
    side: sideToBackend(member.side),
  };
}

function toMobileMember(member: BackendWeddingPartyMember, fallback?: WeddingPartyMember): WeddingPartyMember {
  const notes = member.notes?.trim();
  return {
    attireStatus: attireToMobile(member.outfitDetails, fallback?.attireStatus),
    id: String(member.id ?? fallback?.id ?? `party-${Date.now()}`),
    name: member.name?.trim() || fallback?.name || 'Wedding party member',
    phone: member.phone?.trim() || fallback?.phone || '',
    role: member.role?.trim() || fallback?.role || 'Wedding Party',
    side: sideToMobile(member.side) || fallback?.side || 'Shared',
    tasks: notes ? notes.split(',').map((task) => task.trim()).filter(Boolean) : fallback?.tasks || [],
  };
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.error || body.message || 'Wedding party sync failed.';
  } catch {
    return 'Wedding party sync failed.';
  }
}

export async function createMobileWeddingPartyMember(member: WeddingPartyMember): Promise<WeddingPartySyncResult> {
  const response = await mobileAuthFetch('/api/wedding-party', {
    body: JSON.stringify(partyPayload(member)),
    method: 'POST',
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { member: toMobileMember((await response.json()) as BackendWeddingPartyMember, member), synced: true };
}

export async function updateMobileWeddingPartyMember(member: WeddingPartyMember): Promise<WeddingPartySyncResult> {
  if (!isBackendId(member.id)) return { synced: false };
  const response = await mobileAuthFetch(`/api/wedding-party/${member.id}`, {
    body: JSON.stringify(partyPayload(member)),
    method: 'PATCH',
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { member: toMobileMember((await response.json()) as BackendWeddingPartyMember, member), synced: true };
}

export async function deleteMobileWeddingPartyMember(memberId: string): Promise<{ synced: boolean }> {
  if (!isBackendId(memberId)) return { synced: false };
  const response = await mobileAuthFetch(`/api/wedding-party/${memberId}`, { method: 'DELETE' });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { synced: true };
}
