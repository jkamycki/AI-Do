import { Router } from "express";
import { getAuth } from "@clerk/express";
import {
  db,
  invitationCustomizations,
  weddingProfiles,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
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

    // Verify user has access to this profile
    const [profile] = await db
      .select({ id: weddingProfiles.id })
      .from(weddingProfiles)
      .where(eq(weddingProfiles.id, profileId));

    if (!profile) {
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
        backgroundImageUrl: null,
        textOverrides: {},
        useGeneratedInvitation: true,
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
      textOverrides,
      useGeneratedInvitation,
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
      textOverrides?: Record<
        string,
        { x?: number; y?: number; font?: string; color?: string; fontSize?: number }
      >;
      useGeneratedInvitation?: boolean;
    };

    if (!profileId) {
      return res.status(400).json({ error: "profileId is required" });
    }

    // Verify user has access to this profile
    const [profile] = await db
      .select({ id: weddingProfiles.id })
      .from(weddingProfiles)
      .where(eq(weddingProfiles.id, profileId));

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Validate hex colors if provided
    if (primaryColor) {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/i;
      if (!hexRegex.test(primaryColor)) {
        return res.status(400).json({ error: "Invalid primary color format" });
      }
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
          ...(textOverrides !== undefined && { textOverrides }),
          ...(useGeneratedInvitation !== undefined && { useGeneratedInvitation }),
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
          textOverrides: textOverrides || {},
          useGeneratedInvitation: useGeneratedInvitation ?? true,
        })
        .returning();
      result = created;
    }

    res.json(result);
  } catch (err) {
    req.log.error(err, "invitation-customizations POST");
    res.status(500).json({ error: "Failed to save customizations" });
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

      // Upload to object storage
      const fileName = `invitation-${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const folder = `invitations/${userId}`;
      const url = await storage.uploadFile(
        req.file.buffer,
        fileName,
        req.file.mimetype,
        folder
      );

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
    res.status(400).json({
      error:
        err instanceof Error ? err.message : "Failed to generate color palette",
    });
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
