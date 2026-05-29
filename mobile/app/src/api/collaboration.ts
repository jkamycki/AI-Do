import { mobileAuthJson } from './mobileAuth';

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
    body: JSON.stringify(payload),
    method: 'POST',
  });
}
