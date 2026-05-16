import { db, weddingProfiles, workspaceCollaborators, workspaceActivity } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import type { Request } from "express";

export type CollaboratorRole = "owner" | "partner" | "planner" | "vendor";

export async function getProfileByUserId(userId: string) {
  const rows = await db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.userId, userId))
    .orderBy(asc(weddingProfiles.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listProfilesByUserId(userId: string) {
  return db
    .select()
    .from(weddingProfiles)
    .where(eq(weddingProfiles.userId, userId))
    .orderBy(asc(weddingProfiles.id));
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

/**
 * Returns the userId that data should be SCOPED to for the current request.
 *
 * For owners, this is their own userId. For collaborators, this is the
 * workspace owner's userId — so partners/planners see all the workspace's
 * data (and writes go into the same shared bucket) instead of being trapped
 * in their own empty user scope.
 *
 * Returns the caller's own userId as a safe fallback if no workspace context
 * is set or no profile exists yet.
 */
export async function resolveScopeUserId(req: Request): Promise<string> {
  const profile = await resolveProfile(req);
  return profile?.userId || req.userId!;
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
    const ownProfile = await getProfileByUserId(req.userId!);
    if (ownProfile) return ownProfile;

    // Collaboration-first fallback: if the caller doesn't have their own
    // profile yet but is an active collaborator on exactly one workspace,
    // default to that workspace so shared data (profile, guests, etc.)
    // loads consistently without requiring an explicit workspace selection.
    const shared = await db
      .select({ profileId: workspaceCollaborators.profileId })
      .from(workspaceCollaborators)
      .where(
        and(
          eq(workspaceCollaborators.inviteeUserId, req.userId!),
          eq(workspaceCollaborators.status, "active")
        )
      )
      .limit(2);

    if (shared.length === 1) {
      const rows = await db
        .select()
        .from(weddingProfiles)
        .where(eq(weddingProfiles.id, shared[0].profileId))
        .limit(1);
      return rows[0] ?? null;
    }

    return null;
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

/**
 * Returns the CollaboratorRole of the authenticated caller in the current
 * workspace context. If no workspace header is present and the caller has an
 * own profile, "owner" is returned. If the caller has no profile but exactly
 * one active shared workspace, return that collaborator role so the
 * collaboration-first fallback in resolveProfile cannot accidentally elevate a
 * vendor/planner into an owner. If the header is present but the caller is not
 * an active member, the most-restricted role "vendor" is returned so downstream
 * hasMinRole checks fail safely.
 */
export async function resolveCallerRole(req: Request): Promise<CollaboratorRole> {
  const headerVal = req.headers["x-workspace-profile-id"];
  const workspaceId = headerVal
    ? parseInt(String(headerVal))
    : req.query.workspaceId
      ? parseInt(String(req.query.workspaceId))
      : null;

  if (!workspaceId || isNaN(workspaceId)) {
    const ownProfile = await getProfileByUserId(req.userId!);
    if (ownProfile) return "owner";

    const shared = await db
      .select({ role: workspaceCollaborators.role })
      .from(workspaceCollaborators)
      .where(
        and(
          eq(workspaceCollaborators.inviteeUserId, req.userId!),
          eq(workspaceCollaborators.status, "active")
        )
      )
      .limit(2);

    if (shared.length === 1) {
      return shared[0].role as CollaboratorRole;
    }

    return "owner";
  }

  const role = await resolveWorkspaceRole(req.userId!, workspaceId);
  return role ?? "vendor";
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
