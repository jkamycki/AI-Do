import { clerkClient } from "@clerk/express";
import { db, guests, weddingProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import { FROM_EMAIL, sendEmail } from "./resend";

type LoggerLike = {
  warn: (obj: Record<string, unknown>, msg?: string) => void;
};

type GuestRecord = typeof guests.$inferSelect;

type ProfileSummary = {
  userId: string | null;
  partner1Name: string | null;
  partner2Name: string | null;
  weddingDate: string | null;
};

type WebsiteRsvpBackup = {
  name: string;
  email?: string | null;
  attending: "yes" | "no" | "maybe";
  plusOneCount?: number | null;
  dietaryRestrictions?: string | null;
  message?: string | null;
  submittedAt?: Date | string | null;
};

export type RsvpBackupSource =
  | "public_rsvp_link"
  | "website_guest_rsvp"
  | "website_self_add"
  | "shared_invitation_rsvp"
  | "shared_invitation_self_add"
  | "manual_guest_update"
  | "website_form_rsvp";

const SOURCE_LABELS: Record<RsvpBackupSource, string> = {
  public_rsvp_link: "Guest RSVP link",
  website_guest_rsvp: "Wedding website guest RSVP",
  website_self_add: "Wedding website self-add RSVP",
  shared_invitation_rsvp: "Shared invitation RSVP",
  shared_invitation_self_add: "Shared invitation self-add RSVP",
  manual_guest_update: "Guest list manual update",
  website_form_rsvp: "Wedding website RSVP form",
};

function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function coupleDisplayName(profile: Pick<ProfileSummary, "partner1Name" | "partner2Name">) {
  return [profile.partner2Name, profile.partner1Name].filter(Boolean).join(" & ") || "Your wedding";
}

function formatStatus(status: string | null | undefined) {
  if (status === "attending") return "Attending";
  if (status === "declined") return "Declined";
  if (status === "maybe") return "Maybe";
  if (status === "yes") return "Attending";
  if (status === "no") return "Declined";
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "(none)";
}

function valueOrNone(value: unknown) {
  if (value === null || value === undefined || value === "") return "(none)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

async function getProfileSummary(profileId: number): Promise<ProfileSummary | null> {
  const [profile] = await db
    .select({
      userId: weddingProfiles.userId,
      partner1Name: weddingProfiles.partner1Name,
      partner2Name: weddingProfiles.partner2Name,
      weddingDate: weddingProfiles.weddingDate,
    })
    .from(weddingProfiles)
    .where(eq(weddingProfiles.id, profileId))
    .limit(1);

  return profile
    ? {
        userId: profile.userId || null,
        partner1Name: profile.partner1Name || null,
        partner2Name: profile.partner2Name || null,
        weddingDate: profile.weddingDate || null,
      }
    : null;
}

async function getOwnerEmail(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const owner = await clerkClient.users.getUser(userId);
  return owner.emailAddresses.find((e) => e.id === owner.primaryEmailAddressId)?.emailAddress
    ?? owner.emailAddresses[0]?.emailAddress
    ?? null;
}

function buildHtml(lines: string[]) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
    <h2 style="margin:0 0 12px">RSVP backup copy</h2>
    ${lines.map((line) => `<p style="margin:4px 0">${escapeHtml(line)}</p>`).join("")}
  </div>`;
}

export async function sendGuestRsvpBackupEmail({
  profileId,
  guest,
  source,
  logger,
}: {
  profileId: number;
  guest: GuestRecord;
  source: RsvpBackupSource;
  logger?: LoggerLike;
}) {
  try {
    const profile = await getProfileSummary(profileId);
    const to = await getOwnerEmail(profile?.userId ?? null);
    if (!profile || !to) return;

    const submittedAt = guest.rsvpRespondedAt ? new Date(guest.rsvpRespondedAt).toISOString() : new Date().toISOString();
    const couple = coupleDisplayName(profile);
    const lines = [
      `RSVP backup copy for ${couple}`,
      `Source: ${SOURCE_LABELS[source]}`,
      "",
      `Guest: ${guest.name}`,
      `Guest Email: ${valueOrNone(guest.email)}`,
      `Guest Phone: ${valueOrNone(guest.phone)}`,
      `Response: ${formatStatus(guest.rsvpStatus)}`,
      `Meal Choice: ${valueOrNone(guest.mealChoice)}`,
      `Plus One: ${guest.plusOne ? "Yes" : "No"}`,
      `Plus One Name: ${valueOrNone(guest.plusOneName)}`,
      `Plus One Meal Choice: ${valueOrNone(guest.plusOneMealChoice)}`,
      `Needs Hotel: ${guest.needsHotel ? "Yes" : "No"}`,
      `Hotel Block ID: ${valueOrNone(guest.bookedHotelBlockId)}`,
      `Hotel Rooms: ${valueOrNone(guest.bookedHotelRoomCount)}`,
      `Dietary Restrictions: ${valueOrNone(guest.dietaryNotes)}`,
      `RSVP Message: ${valueOrNone(guest.rsvpMessage)}`,
      `Notes: ${valueOrNone(guest.notes)}`,
      `Submitted At: ${submittedAt}`,
      `Wedding Date: ${valueOrNone(profile.weddingDate)}`,
    ];

    const result = await sendEmail({
      to,
      from: FROM_EMAIL,
      replyTo: FROM_EMAIL,
      subject: `RSVP backup: ${guest.name} - ${formatStatus(guest.rsvpStatus)}`,
      text: lines.join("\n"),
      html: buildHtml(lines),
    });

    if (!result.ok) {
      logger?.warn({ guestId: guest.id, error: result.error }, "Failed to send RSVP backup email");
    }
  } catch (err) {
    logger?.warn({ err, guestId: guest.id }, "Failed to send RSVP backup email");
  }
}

export async function sendWebsiteRsvpBackupEmail({
  profileId,
  rsvp,
  source,
  logger,
}: {
  profileId: number;
  rsvp: WebsiteRsvpBackup;
  source: RsvpBackupSource;
  logger?: LoggerLike;
}) {
  try {
    const profile = await getProfileSummary(profileId);
    const to = await getOwnerEmail(profile?.userId ?? null);
    if (!profile || !to) return;

    const submittedAt = rsvp.submittedAt ? new Date(rsvp.submittedAt).toISOString() : new Date().toISOString();
    const couple = coupleDisplayName(profile);
    const lines = [
      `RSVP backup copy for ${couple}`,
      `Source: ${SOURCE_LABELS[source]}`,
      "",
      `Guest: ${rsvp.name}`,
      `Guest Email: ${valueOrNone(rsvp.email)}`,
      `Response: ${formatStatus(rsvp.attending)}`,
      `Plus One Count: ${valueOrNone(rsvp.plusOneCount ?? 0)}`,
      `Dietary Restrictions: ${valueOrNone(rsvp.dietaryRestrictions)}`,
      `RSVP Message: ${valueOrNone(rsvp.message)}`,
      `Submitted At: ${submittedAt}`,
      `Wedding Date: ${valueOrNone(profile.weddingDate)}`,
    ];

    const result = await sendEmail({
      to,
      from: FROM_EMAIL,
      replyTo: FROM_EMAIL,
      subject: `RSVP backup: ${rsvp.name} - ${formatStatus(rsvp.attending)}`,
      text: lines.join("\n"),
      html: buildHtml(lines),
    });

    if (!result.ok) {
      logger?.warn({ error: result.error }, "Failed to send website RSVP backup email");
    }
  } catch (err) {
    logger?.warn({ err }, "Failed to send website RSVP backup email");
  }
}

export function shouldSendManualRsvpBackupEmail(before: GuestRecord, after: GuestRecord) {
  const wasResponded = before.rsvpStatus && before.rsvpStatus !== "pending";
  const isResponded = after.rsvpStatus && after.rsvpStatus !== "pending";
  return !wasResponded && !!isResponded;
}
