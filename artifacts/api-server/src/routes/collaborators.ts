import { Router } from "express";
import { randomUUID } from "crypto";
import { db, workspaceCollaborators, workspaceActivity, weddingProfiles } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth";
import {
  getProfileByUserId,
  resolveWorkspaceRole,
  hasMinRole,
  logActivity,
  type CollaboratorRole,
} from "../lib/workspaceAccess";

async function getUserPrimaryEmail(userId: string): Promise<string | null> {
  try {
    const u = await clerkClient.users.getUser(userId);
    const primaryId = u.primaryEmailAddressId;
    const primary =
      u.emailAddresses.find((e) => e.id === primaryId) ?? u.emailAddresses[0];
    return primary?.emailAddress?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

const router = Router();

router.get("/invites/pending", requireAuth, async (req, res) => {
  try {
    const myEmail = await getUserPrimaryEmail(req.userId!);
    if (!myEmail) return res.json({ pending: [] });

    const pending = await db
      .select({
        id: workspaceCollaborators.id,
        role: workspaceCollaborators.role,
        status: workspaceCollaborators.status,
        inviteToken: workspaceCollaborators.inviteToken,
        invitedAt: workspaceCollaborators.invitedAt,
        profileId: workspaceCollaborators.profileId,
        partner1Name: weddingProfiles.partner1Name,
        partner2Name: weddingProfiles.partner2Name,
        weddingDate: weddingProfiles.weddingDate,
      })
      .from(workspaceCollaborators)
      .innerJoin(weddingProfiles, eq(workspaceCollaborators.profileId, weddingProfiles.id))
      .where(
        and(
          eq(workspaceCollaborators.inviteeEmail, myEmail),
          eq(workspaceCollaborators.status, "pending"),
        ),
      )
      .orderBy(workspaceCollaborators.invitedAt);

    res.json({
      pending: pending.map((p) => ({
        ...p,
        invitedAt: p.invitedAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error(err, "Failed to fetch pending invites");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/collaborators", requireAuth, async (req, res) => {
  try {
    const workspaceIdParam = req.query.workspaceId ? parseInt(String(req.query.workspaceId)) : null;

    let profile: Awaited<ReturnType<typeof getProfileByUserId>> | null = null;
    let myRole: string = "owner";

    if (workspaceIdParam) {
      const role = await resolveWorkspaceRole(req.userId!, workspaceIdParam);
      if (!role) return res.status(403).json({ error: "Access denied." });
      myRole = role;
      const rows = await db.select().from(weddingProfiles).where(eq(weddingProfiles.id, workspaceIdParam)).limit(1);
      profile = rows[0] ?? null;
    } else {
      profile = await getProfileByUserId(req.userId!);
      myRole = "owner";
    }

    if (!profile) return res.json({ collaborators: [], pendingForMe: [], myRole });

    const collaborators = await db
      .select()
      .from(workspaceCollaborators)
      .where(eq(workspaceCollaborators.profileId, profile.id))
      .orderBy(workspaceCollaborators.invitedAt);

    const myEmail = await getUserPrimaryEmail(req.userId!);
    const pendingForMe = myEmail
      ? await db
          .select({
            id: workspaceCollaborators.id,
            role: workspaceCollaborators.role,
            status: workspaceCollaborators.status,
            inviteToken: workspaceCollaborators.inviteToken,
            invitedAt: workspaceCollaborators.invitedAt,
            profileId: workspaceCollaborators.profileId,
            partner1Name: weddingProfiles.partner1Name,
            partner2Name: weddingProfiles.partner2Name,
            inviterUserId: workspaceCollaborators.inviterUserId,
          })
          .from(workspaceCollaborators)
          .innerJoin(weddingProfiles, eq(workspaceCollaborators.profileId, weddingProfiles.id))
          .where(
            and(
              eq(workspaceCollaborators.inviteeEmail, myEmail),
              eq(workspaceCollaborators.status, "pending")
            )
          )
      : [];

    const isLowPrivilege = !hasMinRole(myRole as CollaboratorRole, "partner");
    res.json({
      collaborators: collaborators.map(c => {
        const base = {
          id: c.id,
          profileId: c.profileId,
          role: c.role,
          status: c.status,
          invitedAt: c.invitedAt.toISOString(),
          acceptedAt: c.acceptedAt?.toISOString() ?? null,
        };
        if (isLowPrivilege) return base;
        return {
          ...base,
          inviteeEmail: c.inviteeEmail,
          inviteeUserId: c.inviteeUserId,
          inviterUserId: c.inviterUserId,
          inviteToken: c.inviteToken,
        };
      }),
      workspaceName: `${profile.partner1Name} & ${profile.partner2Name}`,
      profileId: profile.id,
      myRole,
    });
  } catch (err) {
    req.log.error(err, "Failed to fetch collaborators");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/collaborators/my-workspaces", requireAuth, async (req, res) => {
  try {
    const ownProfile = await getProfileByUserId(req.userId!);

    const sharedWorkspaces = await db
      .select({
        id: workspaceCollaborators.id,
        profileId: workspaceCollaborators.profileId,
        role: workspaceCollaborators.role,
        status: workspaceCollaborators.status,
        partner1Name: weddingProfiles.partner1Name,
        partner2Name: weddingProfiles.partner2Name,
        weddingDate: weddingProfiles.weddingDate,
      })
      .from(workspaceCollaborators)
      .innerJoin(weddingProfiles, eq(workspaceCollaborators.profileId, weddingProfiles.id))
      .where(
        and(
          or(
            eq(workspaceCollaborators.inviteeUserId, req.userId!),
          ),
          eq(workspaceCollaborators.status, "active")
        )
      );

    res.json({
      ownProfile: ownProfile
        ? {
            profileId: ownProfile.id,
            partner1Name: ownProfile.partner1Name,
            partner2Name: ownProfile.partner2Name,
            weddingDate: ownProfile.weddingDate,
          }
        : null,
      sharedWorkspaces,
    });
  } catch (err) {
    req.log.error(err, "Failed to fetch workspaces");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/collaborators/invite", requireAuth, async (req, res) => {
  try {
    const { email, role, workspaceId: bodyWorkspaceId } = req.body as { email: string; role: string; workspaceId?: number };

    let profile: Awaited<ReturnType<typeof getProfileByUserId>> | null = null;

    if (bodyWorkspaceId) {
      const myRole = await resolveWorkspaceRole(req.userId!, bodyWorkspaceId);
      if (!hasMinRole(myRole, "partner")) {
        return res.status(403).json({ error: "Only owners and partners can invite collaborators." });
      }
      const rows = await db.select().from(weddingProfiles).where(eq(weddingProfiles.id, bodyWorkspaceId)).limit(1);
      profile = rows[0] ?? null;
    } else {
      profile = await getProfileByUserId(req.userId!);
    }

    if (!profile) {
      return res.status(400).json({ error: "Create your wedding profile first before inviting collaborators." });
    }

    if (!email || !role) {
      return res.status(400).json({ error: "Email and role are required." });
    }
    if (!["partner", "planner", "vendor"].includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }

    const existing = await db
      .select()
      .from(workspaceCollaborators)
      .where(
        and(
          eq(workspaceCollaborators.profileId, profile.id),
          eq(workspaceCollaborators.inviteeEmail, email.toLowerCase()),
          or(
            eq(workspaceCollaborators.status, "pending"),
            eq(workspaceCollaborators.status, "active")
          )
        )
      )
      .limit(1);

    if (existing.length) {
      return res.status(409).json({ error: "This person is already a collaborator or has a pending invite." });
    }

    const token = randomUUID();

    const [collab] = await db
      .insert(workspaceCollaborators)
      .values({
        profileId: profile.id,
        inviterUserId: req.userId!,
        inviteeEmail: email.toLowerCase(),
        role,
        status: "pending",
        inviteToken: token,
      })
      .returning();

    await logActivity(
      profile.id,
      req.userId!,
      `Invited ${email} as ${role}`,
      "collaborator",
      { email, role, collaboratorId: collab.id }
    );

    res.json({
      ...collab,
      inviteToken: token,
      invitedAt: collab.invitedAt.toISOString(),
      acceptedAt: null,
    });
  } catch (err) {
    req.log.error(err, "Failed to invite collaborator");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invite/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const [collab] = await db
      .select({
        id: workspaceCollaborators.id,
        role: workspaceCollaborators.role,
        status: workspaceCollaborators.status,
        inviteeEmail: workspaceCollaborators.inviteeEmail,
        invitedAt: workspaceCollaborators.invitedAt,
        profileId: workspaceCollaborators.profileId,
        partner1Name: weddingProfiles.partner1Name,
        partner2Name: weddingProfiles.partner2Name,
        weddingDate: weddingProfiles.weddingDate,
        venue: weddingProfiles.venue,
        inviterUserId: workspaceCollaborators.inviterUserId,
      })
      .from(workspaceCollaborators)
      .innerJoin(weddingProfiles, eq(workspaceCollaborators.profileId, weddingProfiles.id))
      .where(eq(workspaceCollaborators.inviteToken, token))
      .limit(1);

    if (!collab) {
      return res.status(404).json({ error: "Invite not found or has expired." });
    }

    const maskedEmail = maskEmail(collab.inviteeEmail);

    res.json({
      ...collab,
      inviteeEmail: maskedEmail,
      invitedAt: collab.invitedAt.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invite/:token/accept", requireAuth, async (req, res) => {
  try {
    const token = String(req.params.token ?? "");

    const [collab] = await db
      .select()
      .from(workspaceCollaborators)
      .where(eq(workspaceCollaborators.inviteToken, token))
      .limit(1);

    if (!collab) return res.status(404).json({ error: "Invite not found." });
    if (collab.status !== "pending") {
      return res.status(400).json({ error: `Invite is already ${collab.status}.` });
    }

    const userEmail = await getUserPrimaryEmail(req.userId!);
    if (!userEmail || userEmail !== collab.inviteeEmail.toLowerCase()) {
      return res.status(403).json({
        error: "This invitation was sent to a different email address. Please sign in with the correct account.",
      });
    }

    const [updated] = await db
      .update(workspaceCollaborators)
      .set({
        status: "active",
        inviteeUserId: req.userId!,
        acceptedAt: new Date(),
      })
      .where(eq(workspaceCollaborators.id, collab.id))
      .returning();

    // Fetch the profile info so the frontend can set activeWorkspace immediately
    const [profile] = await db
      .select({
        partner1Name: weddingProfiles.partner1Name,
        partner2Name: weddingProfiles.partner2Name,
        weddingDate: weddingProfiles.weddingDate,
      })
      .from(weddingProfiles)
      .where(eq(weddingProfiles.id, collab.profileId))
      .limit(1);

    await logActivity(
      collab.profileId,
      req.userId!,
      `Joined as ${collab.role}`,
      "collaborator",
      { collaboratorId: collab.id, role: collab.role }
    );

    res.json({
      profileId: collab.profileId,
      role: collab.role,
      partner1Name: profile?.partner1Name ?? "",
      partner2Name: profile?.partner2Name ?? "",
      weddingDate: profile?.weddingDate ?? "",
      invitedAt: updated.invitedAt.toISOString(),
      acceptedAt: updated.acceptedAt?.toISOString() ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invite/:token/decline", requireAuth, async (req, res) => {
  try {
    const token = String(req.params.token ?? "");

    const [collab] = await db
      .select()
      .from(workspaceCollaborators)
      .where(eq(workspaceCollaborators.inviteToken, token))
      .limit(1);

    if (!collab) return res.status(404).json({ error: "Invite not found." });

    const userEmail = await getUserPrimaryEmail(req.userId!);
    if (!userEmail || userEmail !== collab.inviteeEmail.toLowerCase()) {
      return res.status(403).json({
        error: "This invitation was sent to a different email address.",
      });
    }

    await db
      .update(workspaceCollaborators)
      .set({ status: "declined" })
      .where(eq(workspaceCollaborators.id, collab.id));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/collaborators/:id/role", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { role } = req.body as { role: string };

    if (!["partner", "planner", "vendor"].includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }

    const [collab] = await db
      .select()
      .from(workspaceCollaborators)
      .where(eq(workspaceCollaborators.id, id))
      .limit(1);

    if (!collab) return res.status(404).json({ error: "Collaborator not found." });

    const myRole = await resolveWorkspaceRole(req.userId!, collab.profileId);
    if (!hasMinRole(myRole, "partner")) return res.status(403).json({ error: "Only owners and partners can change roles." });

    const [updated] = await db
      .update(workspaceCollaborators)
      .set({ role })
      .where(eq(workspaceCollaborators.id, id))
      .returning();

    await logActivity(
      collab.profileId,
      req.userId!,
      `Changed ${collab.inviteeEmail}'s role to ${role}`,
      "collaborator",
      { collaboratorId: id, oldRole: collab.role, newRole: role }
    );

    res.json({
      ...updated,
      invitedAt: updated.invitedAt.toISOString(),
      acceptedAt: updated.acceptedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error(err, "Failed to update collaborator role");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/collaborators/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);

    const [collab] = await db
      .select()
      .from(workspaceCollaborators)
      .where(eq(workspaceCollaborators.id, id))
      .limit(1);

    if (!collab) return res.status(404).json({ error: "Collaborator not found." });

    const myRole = await resolveWorkspaceRole(req.userId!, collab.profileId);
    if (!hasMinRole(myRole, "partner")) return res.status(403).json({ error: "Only owners and partners can remove collaborators." });

    await db.delete(workspaceCollaborators).where(eq(workspaceCollaborators.id, id));

    await logActivity(
      collab.profileId,
      req.userId!,
      `Removed ${collab.inviteeEmail} from workspace`,
      "collaborator",
      { collaboratorId: id, email: collab.inviteeEmail }
    );

    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to remove collaborator");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/collaborators/:id/resend", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);

    const [collab] = await db
      .select()
      .from(workspaceCollaborators)
      .where(eq(workspaceCollaborators.id, id))
      .limit(1);

    if (!collab) return res.status(404).json({ error: "Collaborator not found." });

    const myRole = await resolveWorkspaceRole(req.userId!, collab.profileId);
    if (!hasMinRole(myRole, "partner")) return res.status(403).json({ error: "Only owners and partners can resend invites." });

    const newToken = randomUUID();
    const [updated] = await db
      .update(workspaceCollaborators)
      .set({ inviteToken: newToken, status: "pending" })
      .where(eq(workspaceCollaborators.id, id))
      .returning();

    res.json({
      ...updated,
      invitedAt: updated.invitedAt.toISOString(),
      acceptedAt: null,
    });
  } catch (err) {
    req.log.error(err, "Failed to resend invite");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
