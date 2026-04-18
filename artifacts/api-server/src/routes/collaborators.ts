import { Router } from "express";
import { randomUUID } from "crypto";
import { db, workspaceCollaborators, workspaceActivity, weddingProfiles } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import {
  getProfileByUserId,
  resolveWorkspaceRole,
  logActivity,
} from "../lib/workspaceAccess";

const router = Router();

router.get("/collaborators", requireAuth, async (req, res) => {
  try {
    const profile = await getProfileByUserId(req.userId!);
    if (!profile) return res.json({ collaborators: [], pendingForMe: [] });

    const collaborators = await db
      .select()
      .from(workspaceCollaborators)
      .where(eq(workspaceCollaborators.profileId, profile.id))
      .orderBy(workspaceCollaborators.invitedAt);

    const pendingForMe = await db
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
          eq(workspaceCollaborators.inviteeEmail, req.userId!),
          eq(workspaceCollaborators.status, "pending")
        )
      );

    res.json({
      collaborators: collaborators.map(c => ({
        ...c,
        invitedAt: c.invitedAt.toISOString(),
        acceptedAt: c.acceptedAt?.toISOString() ?? null,
      })),
      workspaceName: `${profile.partner1Name} & ${profile.partner2Name}`,
      profileId: profile.id,
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
    const profile = await getProfileByUserId(req.userId!);
    if (!profile) {
      return res.status(400).json({ error: "Create your wedding profile first before inviting collaborators." });
    }

    const { email, role } = req.body as { email: string; role: string };

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

    res.json({
      ...collab,
      invitedAt: collab.invitedAt.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invite/:token/accept", requireAuth, async (req, res) => {
  try {
    const { token } = req.params;

    const [collab] = await db
      .select()
      .from(workspaceCollaborators)
      .where(eq(workspaceCollaborators.inviteToken, token))
      .limit(1);

    if (!collab) return res.status(404).json({ error: "Invite not found." });
    if (collab.status !== "pending") {
      return res.status(400).json({ error: `Invite is already ${collab.status}.` });
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

    await logActivity(
      collab.profileId,
      req.userId!,
      `Joined as ${collab.role}`,
      "collaborator",
      { collaboratorId: collab.id, role: collab.role }
    );

    res.json({
      ...updated,
      invitedAt: updated.invitedAt.toISOString(),
      acceptedAt: updated.acceptedAt?.toISOString() ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invite/:token/decline", requireAuth, async (req, res) => {
  try {
    const { token } = req.params;

    const [collab] = await db
      .select()
      .from(workspaceCollaborators)
      .where(eq(workspaceCollaborators.inviteToken, token))
      .limit(1);

    if (!collab) return res.status(404).json({ error: "Invite not found." });

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
    const id = parseInt(req.params.id);
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
    if (myRole !== "owner") return res.status(403).json({ error: "Only the owner can change roles." });

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
    const id = parseInt(req.params.id);

    const [collab] = await db
      .select()
      .from(workspaceCollaborators)
      .where(eq(workspaceCollaborators.id, id))
      .limit(1);

    if (!collab) return res.status(404).json({ error: "Collaborator not found." });

    const myRole = await resolveWorkspaceRole(req.userId!, collab.profileId);
    if (myRole !== "owner") return res.status(403).json({ error: "Only the owner can remove collaborators." });

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
    const id = parseInt(req.params.id);

    const [collab] = await db
      .select()
      .from(workspaceCollaborators)
      .where(eq(workspaceCollaborators.id, id))
      .limit(1);

    if (!collab) return res.status(404).json({ error: "Collaborator not found." });

    const myRole = await resolveWorkspaceRole(req.userId!, collab.profileId);
    if (myRole !== "owner") return res.status(403).json({ error: "Only the owner can resend invites." });

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
