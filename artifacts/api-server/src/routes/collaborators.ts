import { Router } from "express";
import { randomUUID } from "crypto";
import { db, workspaceCollaborators, workspaceActivity, weddingProfiles } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth";
import {
  getProfileByUserId,
  listProfilesByUserId,
  resolveWorkspaceRole,
  hasMinRole,
  logActivity,
  type CollaboratorRole,
} from "../lib/workspaceAccess";
import { trackEvent } from "../lib/trackEvent";
import { sendEmail } from "../lib/resend";

const DEFAULT_PUBLIC_ORIGIN = "https://aidowedding.net";

function getPublicOrigin(): string {
  const raw = process.env.FRONTEND_URL ?? process.env.PUBLIC_APP_URL ?? process.env.APP_ORIGIN ?? DEFAULT_PUBLIC_ORIGIN;
  try {
    const url = new URL(raw);
    return url.origin.replace(/\/$/, "");
  } catch {
    return DEFAULT_PUBLIC_ORIGIN;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function roleLabel(role: string): string {
  if (role === "partner") return "Partner";
  if (role === "planner") return "Planner";
  if (role === "vendor") return "Vendor";
  return "Collaborator";
}

function workspaceName(profile: { workstationName?: string | null; partner1Name?: string | null; partner2Name?: string | null }): string {
  const custom = profile.workstationName?.trim();
  if (custom) return custom;
  const names = [profile.partner1Name, profile.partner2Name].map((name) => name?.trim()).filter(Boolean);
  return names.length ? names.join(" & ") : "a wedding workspace";
}

function buildInviteUrl(token: string): string {
  return `${getPublicOrigin()}/invite/${encodeURIComponent(token)}`;
}

async function sendCollaboratorInviteEmail(args: {
  to: string;
  workspaceName: string;
  role: string;
  inviteUrl: string;
  resent?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const roleName = roleLabel(args.role);
  const subject = args.resent
    ? `Reminder: accept your A.IDO invite for ${args.workspaceName}`
    : `You're invited to collaborate on ${args.workspaceName}`;
  const text = [
    "Hi there!",
    "",
    `You've been invited to collaborate on ${args.workspaceName} as a ${roleName} on A.IDO.`,
    "",
    `Accept your invitation here: ${args.inviteUrl}`,
    "",
    "If the button or link does not open, copy and paste the link into your browser.",
  ].join("\n");
  const safeWorkspace = escapeHtml(args.workspaceName);
  const safeRole = escapeHtml(roleName);
  const safeInviteUrl = escapeHtml(args.inviteUrl);
  const html = `
<div style="margin:0;padding:0;background:#fff7f2;font-family:Arial,Helvetica,sans-serif;color:#3a1826;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fffaf7;border:1px solid #ead8cf;border-radius:18px;padding:28px;box-shadow:0 10px 28px rgba(61,24,38,0.08);">
      <p style="margin:0 0 10px;color:#8d294d;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">A.IDO collaboration invite</p>
      <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;color:#3a1826;font-size:28px;line-height:1.15;">Join ${safeWorkspace}</h1>
      <p style="margin:0 0 18px;color:#6f4b5a;font-size:15px;line-height:1.55;">
        You've been invited to collaborate as a <strong style="color:#3a1826;">${safeRole}</strong>.
      </p>
      <a href="${safeInviteUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#8d294d;color:#ffffff;text-decoration:none;font-weight:700;border-radius:12px;padding:13px 20px;font-size:15px;">
        Accept invitation
      </a>
      <p style="margin:20px 0 8px;color:#6f4b5a;font-size:13px;line-height:1.5;">Or copy and paste this link into your browser:</p>
      <p style="margin:0;word-break:break-all;">
        <a href="${safeInviteUrl}" target="_blank" rel="noopener noreferrer" style="color:#8d294d;text-decoration:underline;">${safeInviteUrl}</a>
      </p>
    </div>
  </div>
</div>`;

  const result = await sendEmail({
    to: args.to,
    subject,
    text,
    html,
    fromName: "A.IDO Collaboration",
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

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
        };
      }),
      workspaceName: profile.workstationName || `${profile.partner2Name} & ${profile.partner1Name}`,
      workstationName: profile.workstationName,
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
    const ownedProfiles = await listProfilesByUserId(req.userId!);
    const ownProfile = ownedProfiles[0] ?? null;
    const accountType =
      ownedProfiles.find((p) => p.accountType === "wedding_planner")?.accountType
      ?? ownProfile?.accountType
      ?? "couple_individual";

    const sharedWorkspaces = await db
      .select({
        id: workspaceCollaborators.id,
        profileId: workspaceCollaborators.profileId,
        role: workspaceCollaborators.role,
        status: workspaceCollaborators.status,
        partner1Name: weddingProfiles.partner1Name,
        workstationName: weddingProfiles.workstationName,
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
            workstationName: ownProfile.workstationName,
            partner1Name: ownProfile.partner1Name,
            partner2Name: ownProfile.partner2Name,
            weddingDate: ownProfile.weddingDate,
            accountType: ownProfile.accountType,
          }
        : null,
      ownWorkspaces: ownedProfiles.map((p) => ({
        profileId: p.id,
        workstationName: p.workstationName,
        partner1Name: p.partner1Name,
        partner2Name: p.partner2Name,
        weddingDate: p.weddingDate,
        accountType: p.accountType,
        role: "owner",
      })),
      accountType,
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
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

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

    if (!normalizedEmail || !role) {
      return res.status(400).json({ error: "Email and role are required." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (!["partner", "planner", "vendor"].includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }
    const myEmail = await getUserPrimaryEmail(req.userId!);
    if (myEmail && normalizedEmail === myEmail) {
      return res.status(400).json({ error: "You cannot invite yourself to your own workspace." });
    }

    const existing = await db
      .select()
      .from(workspaceCollaborators)
      .where(
        and(
          eq(workspaceCollaborators.profileId, profile.id),
          eq(workspaceCollaborators.inviteeEmail, normalizedEmail),
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
        inviteeEmail: normalizedEmail,
        role,
        status: "pending",
        inviteToken: token,
      })
      .returning();

    await logActivity(
      profile.id,
      req.userId!,
      `Invited ${normalizedEmail} as ${role}`,
      "collaborator",
      { email: normalizedEmail, role, collaboratorId: collab.id }
    );

    const inviteUrl = buildInviteUrl(token);
    const emailResult = await sendCollaboratorInviteEmail({
      to: normalizedEmail,
      workspaceName: workspaceName(profile),
      role,
      inviteUrl,
    });
    if (!emailResult.ok) {
      req.log.warn({ email: normalizedEmail, error: emailResult.error }, "Failed to send collaborator invite email");
    }

    res.json({
      ...collab,
      inviteToken: token,
      invitedAt: collab.invitedAt.toISOString(),
      acceptedAt: null,
      inviteUrl,
      emailSent: emailResult.ok,
      emailError: emailResult.error ?? null,
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
        workstationName: weddingProfiles.workstationName,
        partner2Name: weddingProfiles.partner2Name,
        weddingDate: weddingProfiles.weddingDate,
        venue: weddingProfiles.venue,
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
      .where(and(eq(workspaceCollaborators.id, collab.id), eq(workspaceCollaborators.status, "pending")))
      .returning();
    if (!updated) {
      return res.status(409).json({ error: "Invite was already accepted or is no longer pending." });
    }

    // Fetch the profile info so the frontend can set activeWorkspace immediately
    const [profile] = await db
      .select({
        partner1Name: weddingProfiles.partner1Name,
        partner2Name: weddingProfiles.partner2Name,
        weddingDate: weddingProfiles.weddingDate,
        workstationName: weddingProfiles.workstationName,
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
    trackEvent(req.userId!, "collaboration_invite_accepted", {
      profileId: collab.profileId,
      role: collab.role,
    });
    trackEvent(req.userId!, "onboarding_completed", {
      via: "collaboration_invite",
      profileId: collab.profileId,
      role: collab.role,
    });

    res.json({
      profileId: collab.profileId,
      role: collab.role,
      workstationName: profile?.workstationName ?? null,
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
    if (collab.status !== "pending") {
      return res.status(400).json({ error: `Invite is already ${collab.status}.` });
    }

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
    if (collab.status === "active") {
      return res.status(400).json({ error: "This collaborator is already active." });
    }

    const myRole = await resolveWorkspaceRole(req.userId!, collab.profileId);
    if (!hasMinRole(myRole, "partner")) return res.status(403).json({ error: "Only owners and partners can resend invites." });

    const [updated] = await db
      .update(workspaceCollaborators)
      .set({
        status: "pending",
        invitedAt: new Date(),
        inviteeUserId: null,
        acceptedAt: null,
      })
      .where(eq(workspaceCollaborators.id, id))
      .returning();

    const [profile] = await db
      .select({
        partner1Name: weddingProfiles.partner1Name,
        partner2Name: weddingProfiles.partner2Name,
        workstationName: weddingProfiles.workstationName,
      })
      .from(weddingProfiles)
      .where(eq(weddingProfiles.id, updated.profileId))
      .limit(1);

    const inviteUrl = buildInviteUrl(updated.inviteToken);
    const emailResult = await sendCollaboratorInviteEmail({
      to: updated.inviteeEmail,
      workspaceName: workspaceName(profile ?? {}),
      role: updated.role,
      inviteUrl,
      resent: true,
    });
    if (!emailResult.ok) {
      req.log.warn({ email: updated.inviteeEmail, error: emailResult.error }, "Failed to resend collaborator invite email");
    }

    res.json({
      ...updated,
      invitedAt: updated.invitedAt.toISOString(),
      acceptedAt: null,
      inviteUrl,
      emailSent: emailResult.ok,
      emailError: emailResult.error ?? null,
    });
  } catch (err) {
    req.log.error(err, "Failed to resend invite");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
