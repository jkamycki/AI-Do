import type { Response } from "express";
import { db, maintenanceFlags } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

export const PUBLIC_MAINTENANCE_SECTION = "public-guest-experience";
export const PORTAL_MAINTENANCE_SECTION = "portal-experience";

export const DEFAULT_MAINTENANCE_MESSAGE =
  "This experience is temporarily unavailable. Please check back soon.";

export const PUBLIC_MAINTENANCE_SECTIONS = [
  "guest-collector",
  "rsvp",
  "save-the-date",
  "wedding-website",
  PUBLIC_MAINTENANCE_SECTION,
] as const;

export const PORTAL_MAINTENANCE_SECTIONS = [
  "portal-dashboard",
  "portal-profile",
  "portal-mood-board",
  "portal-timeline",
  "portal-checklist",
  "portal-vendors",
  "portal-budget",
  "portal-documents",
  "portal-guests",
  "portal-wedding-party",
  "portal-seating-chart",
  "portal-hotels",
  "portal-aria",
  "portal-day-of",
  "portal-website-editor",
  PORTAL_MAINTENANCE_SECTION,
] as const;

export const MAINTENANCE_SECTIONS = [
  ...PUBLIC_MAINTENANCE_SECTIONS,
  ...PORTAL_MAINTENANCE_SECTIONS,
] as const;

export type MaintenanceSection = typeof MAINTENANCE_SECTIONS[number];

export function isMaintenanceSection(section: string): section is MaintenanceSection {
  return MAINTENANCE_SECTIONS.includes(section as MaintenanceSection);
}

export function serializeMaintenanceFlag(flag: typeof maintenanceFlags.$inferSelect) {
  return {
    section: flag.section,
    enabled: isFlagActive(flag),
    configuredEnabled: flag.enabled,
    message: flag.message || DEFAULT_MAINTENANCE_MESSAGE,
    expiresAt: flag.expiresAt?.toISOString() ?? null,
    updatedBy: flag.updatedBy ?? null,
    updatedAt: flag.updatedAt.toISOString(),
  };
}

function isFlagActive(flag: typeof maintenanceFlags.$inferSelect): boolean {
  return flag.enabled && (!flag.expiresAt || flag.expiresAt.getTime() > Date.now());
}

export async function getMaintenanceState(section: MaintenanceSection) {
  const sectionsToCheck: MaintenanceSection[] = [section];
  if ((PUBLIC_MAINTENANCE_SECTIONS as readonly string[]).includes(section)) {
    sectionsToCheck.push(PUBLIC_MAINTENANCE_SECTION);
  }
  if ((PORTAL_MAINTENANCE_SECTIONS as readonly string[]).includes(section)) {
    sectionsToCheck.push(PORTAL_MAINTENANCE_SECTION);
  }

  const rows = await db
    .select()
    .from(maintenanceFlags)
    .where(inArray(maintenanceFlags.section, Array.from(new Set(sectionsToCheck))));

  const active = rows.find(isFlagActive);
  return {
    active: !!active,
    section,
    message: active?.message || DEFAULT_MAINTENANCE_MESSAGE,
    activeSection: active?.section ?? null,
    expiresAt: active?.expiresAt?.toISOString() ?? null,
  };
}

export async function sendMaintenanceIfActive(res: Response, section: MaintenanceSection) {
  const state = await getMaintenanceState(section);
  if (!state.active) return false;
  res.status(503).json({
    error: "Maintenance mode",
    maintenance: state,
  });
  return true;
}

export async function upsertMaintenanceFlag(input: {
  section: MaintenanceSection;
  enabled: boolean;
  message?: string | null;
  expiresAt?: Date | null;
  updatedBy?: string | null;
}) {
  const now = new Date();
  const [row] = await db
    .insert(maintenanceFlags)
    .values({
      section: input.section,
      enabled: input.enabled,
      message: input.message || null,
      expiresAt: input.expiresAt ?? null,
      updatedBy: input.updatedBy ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: maintenanceFlags.section,
      set: {
        enabled: input.enabled,
        message: input.message || null,
        expiresAt: input.expiresAt ?? null,
        updatedBy: input.updatedBy ?? null,
        updatedAt: now,
      },
    })
    .returning();
  return row;
}

export async function listMaintenanceFlags() {
  const rows = await db.select().from(maintenanceFlags);
  const bySection = new Map(rows.map((row: typeof maintenanceFlags.$inferSelect) => [row.section, row]));
  return MAINTENANCE_SECTIONS.map((section) => {
    const row = bySection.get(section);
    if (row) return serializeMaintenanceFlag(row);
    return {
      section,
      enabled: false,
      configuredEnabled: false,
      message: DEFAULT_MAINTENANCE_MESSAGE,
      expiresAt: null,
      updatedBy: null,
      updatedAt: null,
    };
  });
}
