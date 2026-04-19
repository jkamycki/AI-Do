import { db, weddingProfiles, workspaceCollaborators, workspaceActivity } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { Request } from "express";

export type CollaboratorRole = "owner" | "partner" | "planner" | "vendor";

export async function getProfileByUserId(userId: string) {
  const rows = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function resolveWorkspaceRole(
  userId: string,
  profileId: number
): Promise<CollaboratorRole | null> {
  const profile = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.id, profileId))
    .limit(1);

  if (!profile.length) return null;
  if (profile[0].userId === userId) return "owner";

  const collab = await db
    .select()
    .from(workspaceCollaborators)
    .where(
      and(
        eq(workspaceCollaborators.profileId, profileId),
        eq(workspaceCollaborators.inviteeUserId, userId),
        eq(workspaceCollaborators.status, "active")
      )
    )
    .limit(1);

  if (!collab.length) return null;
  return collab[0].role as CollaboratorRole;
}

export async function resolveProfile(req: Request) {
  // Check header first (sent by customFetch when activeWorkspace is set), then query param
  const headerVal = req.headers["x-workspace-profile-id"];
  const workspaceId = headerVal
    ? parseInt(String(headerVal))
    : req.query.workspaceId
      ? parseInt(String(req.query.workspaceId))
      : null;

  if (!workspaceId || isNaN(workspaceId)) {
    return getProfileByUserId(req.userId!);
  }

  const role = await resolveWorkspaceRole(req.userId!, workspaceId);
  if (!role) return null;

  const rows = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.id, workspaceId))
    .limit(1);
  return rows[0] ?? null;
}

const ROLE_RANK: Record<CollaboratorRole, number> = {
  owner: 4,
  partner: 3,
  planner: 2,
  vendor: 1,
};

export function hasMinRole(
  role: CollaboratorRole | null,
  required: CollaboratorRole
): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

export async function logActivity(
  profileId: number,
  userId: string,
  action: string,
  resourceType?: string,
  details?: Record<string, unknown>,
  userName?: string
) {
  try {
    await db.insert(workspaceActivity).values({
      profileId,
      userId,
      userName: userName ?? null,
      action,
      resourceType: resourceType ?? null,
      details: details ?? null,
    });
  } catch {
  }
}
