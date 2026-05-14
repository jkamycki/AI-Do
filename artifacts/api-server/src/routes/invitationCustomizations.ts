import { Router } from "express";
import { getAuth } from "@clerk/express";
import {
  db,
  invitationCustomizations,
  weddingProfiles,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveWorkspaceRole, hasMinRole } from "../lib/workspaceAccess";
import {
  generateColorPaletteFromPrimary,
  PRESET_PALETTES,
  AVAILABLE_FONTS,
  AVAILABLE_LAYOUTS,
  type ColorPalette,
} from "../lib/colorGeneration";
import { ObjectStorageService } from "../lib/objectStorage";
import multer from "multer";

const router = Router();
const storage = new ObjectStorageService();
const upload = multer({ storage: multer.memoryStorage() });

type StoredElementOverride = {
  x?: number;
  y?: number;
  font?: string;
  color?: string;
  fontSize?: number;
  objectX?: number;
  objectY?: number;
  text?: string;
};
type StoredTextOverrides = Record<string, StoredElementOverride>;

function resetPhotoObjectPosition(
  overrides: StoredTextOverrides | null | undefined,
  photoId: "std:photo" | "dig:photo",
): StoredTextOverrides {
  if (!overrides?.[photoId]) return overrides ?? {};
  const rest = { ...overrides[photoId] };
  delete rest.objectX;
  delete rest.objectY;
  const next = { ...overrides };
  if (Object.keys(rest).length === 0) {
    delete next[photoId];
  } else {
    next[photoId] = rest;
  }
  return next;
}

// ─── GET /api/invitation-customizations ───────────────────────────────────
router.get("/invitation-customizations", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const profileId = req.query.profileId
      ? parseInt(req.query.profileId as string)
      : undefined;

    if (!profileId) {
      return res
        .status(400)
        .json({ error: "profileId query parameter is required" });
    }

    // SECURITY: verify the caller actually owns or is an active collaborator
    // on this profile. Previously we only checked the profile existed, which
    // let any authenticated user read another wedding's invitation
    // customization (colors, photo URLs, text overrides) by guessing or
    // enumerating profileId values.
    const role = await resolveWorkspaceRole(req.userId!, profileId);
    if (!role || !hasMinRole(role, "vendor")) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const [customization] = await db
      .select()
      .from(invitationCustomizations)
      .where(eq(invitationCustomizations.profileId, profileId));

    if (!customization) {
      // Return defaults if none exist
      return res.json({
        profileId,
        primaryColor: "#D4A017",
        colorPalette: {
          primary: "#D4A017",
          secondary: "#F5C842",
          accent: "#D4A017",
          neutral: "#E8E0D0",
        },
        customColors: null,
        selectedPalette: null,
        backgroundColor: "#1E1A2E",
        saveTheDatePhotoUrl: null,
        digitalInvitationPhotoUrl: null,
        saveTheDatePhotoPosition: null,
        digitalInvitationPhotoPosition: null,
        selectedFont: "Georgia",
        saveTheDateFont: "Georgia",
        digitalInvitationFont: "Georgia",
        selectedLayout: "classic",
        saveTheDateLayout: "classic",
        digitalInvitationLayout: "classic",
        saveTheDateBackground: "#1E1A2E",
        digitalInvitationBackground: "#1E1A2E",
        saveTheDateAccentColor: null,
        digitalInvitationAccentColor: null,
        backgroundImageUrl: null,
        textOverrides: {},
        useGeneratedInvitation: true,
        rsvpByDate: null,
      });
    }

    res.json(customization);
  } catch (err) {
    req.log.error(err, "invitation-customizations GET");
    res.status(500).json({ error: "Failed to load customizations" });
  }
});

// ─── POST /api/invitation-customizations ──────────────────────────────────
router.post("/invitation-customizations", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      profileId,
      primaryColor,
      colorPalette,
      customColors,
      selectedPalette,
      backgroundColor,
      saveTheDatePhotoUrl,
      digitalInvitationPhotoUrl,
      saveTheDatePhotoPosition,
      digitalInvitationPhotoPosition,
      selectedFont,
      saveTheDateFont,
      digitalInvitationFont,
      selectedLayout,
      saveTheDateLayout,
      digitalInvitationLayout,
      backgroundImageUrl,
      saveTheDateBackground,
      digitalInvitationBackground,
      saveTheDateFontColor,
      digitalInvitationFontColor,
      saveTheDateFontSize,
      digitalInvitationFontSize,
      saveTheDateAccentColor,
      digitalInvitationAccentColor,
      textOverrides,
      useGeneratedInvitation,
      rsvpByDate,
    } = req.body as {
      profileId: number;
      primaryColor?: string;
      colorPalette?: ColorPalette;
      customColors?: Partial<ColorPalette> | null;
      selectedPalette?: string | null;
      backgroundColor?: string | null;
      saveTheDatePhotoUrl?: string | null;
      digitalInvitationPhotoUrl?: string | null;
      saveTheDatePhotoPosition?: { x: number; y: number } | null;
      digitalInvitationPhotoPosition?: { x: number; y: number } | null;
      selectedFont?: string;
      saveTheDateFont?: string;
      digitalInvitationFont?: string;
      selectedLayout?: string;
      saveTheDateLayout?: string;
      digitalInvitationLayout?: string;
      backgroundImageUrl?: string | null;
      saveTheDateBackground?: string | null;
      digitalInvitationBackground?: string | null;
      saveTheDateFontColor?: string | null;
      digitalInvitationFontColor?: string | null;
      saveTheDateFontSize?: string | null;
      digitalInvitationFontSize?: string | null;
      saveTheDateAccentColor?: string | null;
      digitalInvitationAccentColor?: string | null;
      textOverrides?: Record<
        string,
        { x?: number; y?: number; font?: string; color?: string; fontSize?: number }
      >;
      useGeneratedInvitation?: boolean;
      rsvpByDate?: string | null;
    };

    if (!profileId) {
      return res.status(400).json({ error: "profileId is required" });
    }

    // SECURITY: only the workspace owner or a collaborator with at least
    // partner-level access may overwrite invitation customization. Same leak
    // class as the GET handler above — without this check any authenticated
    // user could overwrite another wedding's invitation by sending its
    // profileId in the body.
    const role = await resolveWorkspaceRole(req.userId!, profileId);
    if (!role || !hasMinRole(role, "partner")) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Validate hex colors if provided
    if (primaryColor) {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/i;
      if (!hexRegex.test(primaryColor)) {
        return res.status(400).json({ error: "Invalid primary color format" });
      }
    }

    // Validate RSVP-by date — must be ISO YYYY-MM-DD or empty/null. We store
    // it as text so the same string round-trips through <input type="date">
    // without timezone drift, but reject anything that isn't a real calendar
    // date so a typo doesn't end up rendered on the invitation.
    let normalizedRsvpByDate: string | null | undefined = rsvpByDate;
    if (rsvpByDate !== undefined && rsvpByDate !== null && rsvpByDate !== "") {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rsvpByDate);
      if (!m) {
        return res.status(400).json({ error: "rsvpByDate must be in YYYY-MM-DD format" });
      }
      const [, ys, ms, ds] = m;
      const y = Number(ys), mo = Number(ms), d = Number(ds);
      const probe = new Date(y, mo - 1, d);
      if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) {
        return res.status(400).json({ error: "rsvpByDate is not a valid calendar date" });
      }
    } else if (rsvpByDate === "") {
      normalizedRsvpByDate = null;
    }

    // Reject blob: URLs — they are local browser-session URLs and cannot be persisted
    if (typeof saveTheDatePhotoUrl === "string" && saveTheDatePhotoUrl.startsWith("blob:")) {
      return res.status(400).json({ error: "Cannot save a blob URL for saveTheDatePhotoUrl" });
    }
    if (typeof digitalInvitationPhotoUrl === "string" && digitalInvitationPhotoUrl.startsWith("blob:")) {
      return res.status(400).json({ error: "Cannot save a blob URL for digitalInvitationPhotoUrl" });
    }

    // Check if customization already exists
    const [existing] = await db
      .select({ id: invitationCustomizations.id })
      .from(invitationCustomizations)
      .where(eq(invitationCustomizations.profileId, profileId));

    let result;
    if (existing) {
      const [updated] = await db
        .update(invitationCustomizations)
        .set({
          ...(primaryColor && { primaryColor }),
          ...(colorPalette && { colorPalette }),
          ...(customColors !== undefined && { customColors }),
          ...(selectedPalette !== undefined && { selectedPalette }),
          ...(backgroundColor !== undefined && { backgroundColor }),
          ...(saveTheDatePhotoUrl !== undefined && { saveTheDatePhotoUrl }),
          ...(digitalInvitationPhotoUrl !== undefined && { digitalInvitationPhotoUrl }),
          ...(saveTheDatePhotoPosition !== undefined && { saveTheDatePhotoPosition }),
          ...(digitalInvitationPhotoPosition !== undefined && { digitalInvitationPhotoPosition }),
          ...(selectedFont && { selectedFont }),
          ...(saveTheDateFont !== undefined && { saveTheDateFont }),
          ...(digitalInvitationFont !== undefined && { digitalInvitationFont }),
          ...(selectedLayout && { selectedLayout }),
          ...(saveTheDateLayout !== undefined && { saveTheDateLayout }),
          ...(digitalInvitationLayout !== undefined && { digitalInvitationLayout }),
          ...(backgroundImageUrl !== undefined && { backgroundImageUrl }),
          ...(saveTheDateBackground !== undefined && { saveTheDateBackground }),
          ...(digitalInvitationBackground !== undefined && { digitalInvitationBackground }),
          ...(saveTheDateFontColor !== undefined && { saveTheDateFontColor }),
          ...(digitalInvitationFontColor !== undefined && { digitalInvitationFontColor }),
          ...(saveTheDateFontSize !== undefined && { saveTheDateFontSize }),
          ...(digitalInvitationFontSize !== undefined && { digitalInvitationFontSize }),
          ...(saveTheDateAccentColor !== undefined && { saveTheDateAccentColor }),
          ...(digitalInvitationAccentColor !== undefined && { digitalInvitationAccentColor }),
          ...(textOverrides !== undefined && { textOverrides }),
          ...(useGeneratedInvitation !== undefined && { useGeneratedInvitation }),
          ...(rsvpByDate !== undefined && { rsvpByDate: normalizedRsvpByDate }),
          updatedAt: new Date(),
        })
        .where(eq(invitationCustomizations.profileId, profileId))
        .returning();
      result = updated;
    } else {
      const [created] = await db
        .insert(invitationCustomizations)
        .values({
          profileId,
          primaryColor: primaryColor || "#D4A017",
          colorPalette: colorPalette || {
            primary: "#D4A017",
            secondary: "#F5C842",
            accent: "#7B2FBE",
            neutral: "#666666",
          },
          customColors: customColors || null,
          selectedPalette: selectedPalette || null,
          backgroundColor: backgroundColor || null,
          saveTheDatePhotoUrl: saveTheDatePhotoUrl || null,
          digitalInvitationPhotoUrl: digitalInvitationPhotoUrl || null,
          saveTheDatePhotoPosition: saveTheDatePhotoPosition ?? null,
          digitalInvitationPhotoPosition: digitalInvitationPhotoPosition ?? null,
          selectedFont: selectedFont || "Georgia",
          saveTheDateFont: saveTheDateFont || "Georgia",
          digitalInvitationFont: digitalInvitationFont || "Georgia",
          selectedLayout: selectedLayout || "classic",
          saveTheDateLayout: saveTheDateLayout || "classic",
          digitalInvitationLayout: digitalInvitationLayout || "classic",
          backgroundImageUrl: backgroundImageUrl || null,
          saveTheDateBackground: saveTheDateBackground || null,
          digitalInvitationBackground: digitalInvitationBackground || null,
          saveTheDateFontColor: saveTheDateFontColor || null,
          digitalInvitationFontColor: digitalInvitationFontColor || null,
          saveTheDateFontSize: saveTheDateFontSize || null,
          digitalInvitationFontSize: digitalInvitationFontSize || null,
          saveTheDateAccentColor: saveTheDateAccentColor || null,
          digitalInvitationAccentColor: digitalInvitationAccentColor || null,
          textOverrides: textOverrides || {},
          useGeneratedInvitation: useGeneratedInvitation ?? true,
          rsvpByDate: normalizedRsvpByDate ?? null,
        })
        .returning();
      result = created;
    }

    // .returning() returns an empty array when no row matched the WHERE clause.
    // Guard against sending an empty body (which would cause the client's
    // r.json() to throw a SyntaxError even on a 200 response).
    if (!result) {
      const [fetched] = await db
        .select()
        .from(invitationCustomizations)
        .where(eq(invitationCustomizations.profileId, profileId));
      result = fetched;
    }

    if (!result) {
      return res.status(500).json({ error: "Failed to retrieve saved customization" });
    }

    res.json(result);
  } catch (err) {
    req.log.error(err, "invitation-customizations POST");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/invitation-customizations/upload ────────────────────────────
router.post(
  "/invitation-customizations/upload",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const type = req.query.type as string;
      if (!type || !["save-the-date", "digital-invitation"].includes(type)) {
        return res
          .status(400)
          .json({ error: "Invalid type parameter (use save-the-date or digital-invitation)" });
      }

      const profileId = req.query.profileId
        ? parseInt(req.query.profileId as string, 10)
        : undefined;
      if (req.query.profileId && (!profileId || Number.isNaN(profileId))) {
        return res.status(400).json({ error: "Invalid profileId parameter" });
      }

      // Validate file type
      const allowedMimes = ["image/png", "image/jpeg", "image/webp"];
      if (!allowedMimes.includes(req.file.mimetype)) {
        return res
          .status(400)
          .json({
            error:
              "Invalid file type. Only PNG, JPG, and WebP are supported.",
          });
      }

      // Validate file size (5MB max)
      if (req.file.size > 5 * 1024 * 1024) {
        return res
          .status(413)
          .json({ error: "File is too large. Maximum size is 5MB." });
      }

      if (profileId) {
        // SECURITY: same leak class as GET/POST above — verify membership
        // before letting an upload land on someone else's profile photo.
        const role = await resolveWorkspaceRole(req.userId!, profileId);
        if (!role || !hasMinRole(role, "partner")) {
          return res.status(404).json({ error: "Profile not found" });
        }
      }

      // Upload to object storage
      const fileName = `invitation-${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const folder = `invitations/${userId}`;
      const url = await storage.uploadFile(
        req.file.buffer,
        fileName,
        req.file.mimetype,
        folder
      );

      if (profileId) {
        const [existing] = await db
          .select({
            id: invitationCustomizations.id,
            textOverrides: invitationCustomizations.textOverrides,
          })
          .from(invitationCustomizations)
          .where(eq(invitationCustomizations.profileId, profileId));
        const photoId = type === "save-the-date" ? "std:photo" : "dig:photo";
        const textOverrides = resetPhotoObjectPosition(
          existing?.textOverrides as StoredTextOverrides | null | undefined,
          photoId,
        );
        // Persist the new storage URL before the UI can switch back to Guest List;
        // otherwise the send modal may fetch the previous saved photo.

        if (existing) {
          await db
            .update(invitationCustomizations)
            .set(
              type === "save-the-date"
                ? {
                    saveTheDatePhotoUrl: url,
                    textOverrides,
                    updatedAt: new Date(),
                  }
                : {
                    digitalInvitationPhotoUrl: url,
                    textOverrides,
                    updatedAt: new Date(),
                  },
            )
            .where(eq(invitationCustomizations.profileId, profileId));
        } else {
          await db
            .insert(invitationCustomizations)
            .values(
              type === "save-the-date"
                ? {
                    profileId,
                    saveTheDatePhotoUrl: url,
                    textOverrides,
                  }
                : {
                    profileId,
                    digitalInvitationPhotoUrl: url,
                    textOverrides,
                  },
            );
        }
      }

      res.json({ url });
    } catch (err) {
      req.log.error(err, "invitation-customizations upload");
      res.status(500).json({ error: "Failed to upload file" });
    }
  }
);

// ─── POST /api/color-palette/generate ───────────────────────────────────────
router.post("/color-palette/generate", requireAuth, async (req, res) => {
  try {
    const { primaryColor } = req.body as { primaryColor: string };

    if (!primaryColor) {
      return res.status(400).json({ error: "primaryColor is required" });
    }

    const palette = generateColorPaletteFromPrimary(primaryColor);
    res.json(palette);
  } catch (err) {
    req.log.error(err, "color-palette generate");
    res.status(400).json({ error: "Failed to generate color palette" });
  }
});

// ─── GET /api/color-palettes ──────────────────────────────────────────────
router.get("/color-palettes", async (req, res) => {
  try {
    const palettes = Object.entries(PRESET_PALETTES).map(([id, colors]) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      colors,
    }));

    res.json({ palettes });
  } catch (err) {
    req.log.error(err, "color-palettes GET");
    res.status(500).json({ error: "Failed to load palettes" });
  }
});

// ─── GET /api/invitation-options ──────────────────────────────────────────
router.get("/invitation-options", async (req, res) => {
  try {
    res.json({
      fonts: AVAILABLE_FONTS,
      layouts: AVAILABLE_LAYOUTS,
    });
  } catch (err) {
    req.log.error(err, "invitation-options GET");
    res.status(500).json({ error: "Failed to load options" });
  }
});

export default router;
