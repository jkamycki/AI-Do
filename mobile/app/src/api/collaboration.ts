import { mobileAuthJson } from './mobileAuth';
import { mobileAuthFetch } from './mobileAuth';

export type MobileCollaborator = {
  acceptedAt?: string | null;
  id: number | string;
  inviteeEmail?: string;
  invitedAt?: string;
  profileId?: number;
  role: string;
  status: string;
};

export type MobileInviteResult = MobileCollaborator & {
  emailError?: string | null;
  emailSent?: boolean;
  inviteUrl?: string;
};

export function workspaceRoleToApi(role: string) {
  const normalized = role.trim().toLowerCase();
  if (normalized === 'partner') return 'partner';
  if (normalized === 'vendor') return 'vendor';
  return 'planner';
}

export function workspaceRoleFromApi(role: string) {
  const normalized = role.trim().toLowerCase();
  if (normalized === 'partner') return 'Partner';
  if (normalized === 'vendor') return 'Vendor';
  return 'Planner';
}

export async function listMobileCollaborators() {
  return mobileAuthJson<{
    collaborators: MobileCollaborator[];
    myRole?: string;
    pendingForMe?: MobileCollaborator[];
    profileId?: number;
    workspaceName?: string;
  }>('/api/collaborators');
}

export async function inviteMobileCollaborator(payload: { email: string; role: string; workspaceId?: number }) {
  return mobileAuthJson<MobileInviteResult>('/api/collaborators/invite', {
    body: JSON.stringify({ ...payload, role: workspaceRoleToApi(payload.role) }),
    method: 'POST',
  });
}

export async function deleteMobileCollaborator(collaboratorId: string) {
  if (!/^\d+$/.test(collaboratorId)) return { synced: false };
  const response = await mobileAuthFetch(`/api/collaborators/${collaboratorId}`, { method: 'DELETE' });
  if (!response) return { synced: false };
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(body.error || body.message || 'Could not remove collaborator.');
  }
  return { synced: true };
}
