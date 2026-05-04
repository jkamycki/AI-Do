import type { ColorPalette } from "@/types/invitations";

const PLACEHOLDER_NAMES = new Set([
  "",
  "bride",
  "groom",
  "bride & groom",
  "the couple",
  "couple names",
  "partner 1",
  "partner 2",
  "partner1",
  "partner2",
]);

function isMissingText(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_NAMES.has(trimmed.toLowerCase());
}

function isMissingPhoto(url: string | null | undefined): boolean {
  if (!url) return true;
  if (url.startsWith("blob:")) return true;
  return false;
}

function isMissingPalette(palette: ColorPalette | null | undefined): boolean {
  if (!palette) return true;
  return !palette.primary || !palette.secondary || !palette.accent;
}

export interface CustomDesignCompletenessInput {
  customization: {
    saveTheDatePhotoUrl?: string | null;
    digitalInvitationPhotoUrl?: string | null;
    colorPalette?: ColorPalette | null;
    selectedFont?: string | null;
    saveTheDateFont?: string | null;
    digitalInvitationFont?: string | null;
    selectedLayout?: string | null;
    saveTheDateLayout?: string | null;
    digitalInvitationLayout?: string | null;
  } | null | undefined;
  profile: {
    partner1Name?: string | null;
    partner2Name?: string | null;
    weddingDate?: string | null;
    venue?: string | null;
    ceremonyTime?: string | null;
  } | null | undefined;
}

export interface CustomDesignCompleteness {
  isComplete: boolean;
  missing: string[];
}

export function evaluateCustomDesignCompleteness(
  input: CustomDesignCompletenessInput,
): CustomDesignCompleteness {
  const { customization, profile } = input;
  const missing: string[] = [];

  if (!customization) missing.push("customization");
  if (!profile) missing.push("wedding details");

  if (customization && profile) {
    if (isMissingPhoto(customization.saveTheDatePhotoUrl)) missing.push("Save the Date photo");
    if (isMissingPhoto(customization.digitalInvitationPhotoUrl)) missing.push("RSVP Invitation photo");

    if (isMissingText(profile.partner1Name) || isMissingText(profile.partner2Name)) {
      missing.push("couple names");
    }
    if (isMissingText(profile.weddingDate)) missing.push("wedding date");
    if (isMissingText(profile.venue)) missing.push("venue");

    const stdFont = customization.saveTheDateFont || customization.selectedFont;
    const diFont = customization.digitalInvitationFont || customization.selectedFont;
    if (isMissingText(stdFont) || isMissingText(diFont)) missing.push("font selection");

    if (isMissingPalette(customization.colorPalette)) missing.push("color palette");

    const stdLayout = customization.saveTheDateLayout || customization.selectedLayout;
    const diLayout = customization.digitalInvitationLayout || customization.selectedLayout;
    if (isMissingText(stdLayout) || isMissingText(diLayout)) missing.push("layout");
  }

  return { isComplete: missing.length === 0, missing };
}
