import type { InvitationCustomization, PreviewTab, WeddingProfileData } from "@/types/invitations";

export type InvitationDeliveryMode = "digital" | "print";
export type InvitationDesignMode = "ai" | "custom";

export interface InvitationDesignDocument {
  version: "studio-v1";
  kind: PreviewTab;
  deliveryMode: InvitationDeliveryMode;
  designMode: InvitationDesignMode;
  title: string;
  couple: string;
  message: string | null;
  image: {
    url: string | null;
    position: { x: number; y: number };
    zoom: number;
  };
  style: {
    backgroundColor: string;
    accentColor: string;
    textColor: string;
    fontFamily: string;
    fontSize: string;
  };
  fields: {
    weddingDate: string | null;
    venue: string | null;
    venueAddress: string | null;
    venueCity: string | null;
    venueState: string | null;
    venueZip: string | null;
    ceremonyTime: string | null;
    receptionTime: string | null;
    rsvpByDate: string | null;
  };
}

interface BuildInvitationDesignDocumentInput {
  kind: PreviewTab;
  deliveryMode: InvitationDeliveryMode;
  designMode: InvitationDesignMode;
  profile: WeddingProfileData;
  customization: InvitationCustomization | null | undefined;
  message: string | null;
  photoUrl: string | null;
  photoPosition: { x: number; y: number };
  photoZoom?: number;
  customStyle: {
    backgroundColor: string;
    accentColor: string;
    fontColor: string;
    fontFamily: string;
    fontSize: string;
  };
  rsvpByDate?: string | null;
}

export function buildInvitationDesignDocument({
  kind,
  deliveryMode,
  designMode,
  profile,
  customization,
  message,
  photoUrl,
  photoPosition,
  photoZoom = 1,
  customStyle,
  rsvpByDate,
}: BuildInvitationDesignDocumentInput): InvitationDesignDocument {
  const couple = [profile.partner1Name, profile.partner2Name].filter(Boolean).join(" & ") || "The Couple";
  const isSaveTheDate = kind === "saveTheDate";
  const accentColor = isSaveTheDate
    ? customization?.saveTheDateAccentColor
    : customization?.digitalInvitationAccentColor;
  const textColor = isSaveTheDate
    ? customization?.saveTheDateFontColor
    : customization?.digitalInvitationFontColor;
  const backgroundColor = isSaveTheDate
    ? customization?.saveTheDateBackground
    : customization?.digitalInvitationBackground;
  const fontFamily = isSaveTheDate
    ? customization?.saveTheDateFont
    : customization?.digitalInvitationFont;
  const fontSize = isSaveTheDate
    ? customization?.saveTheDateFontSize
    : customization?.digitalInvitationFontSize;
  return {
    version: "studio-v1",
    kind,
    deliveryMode,
    designMode,
    title: isSaveTheDate ? "Save the Date" : "RSVP Invitation",
    couple,
    message,
    image: {
      url: photoUrl,
      position: photoPosition,
      zoom: photoZoom,
    },
    style: {
      backgroundColor: designMode === "custom" ? customStyle.backgroundColor : backgroundColor || "#1E1A2E",
      accentColor: designMode === "custom" ? customStyle.accentColor : accentColor || "#D4A017",
      textColor: designMode === "custom" ? customStyle.fontColor : textColor || "#ffffff",
      fontFamily: designMode === "custom" ? customStyle.fontFamily : fontFamily || "Playfair Display",
      fontSize: designMode === "custom" ? customStyle.fontSize : fontSize || "16",
    },
    fields: {
      weddingDate: profile.weddingDate || null,
      venue: profile.venue || null,
      venueAddress: profile.location || null,
      venueCity: profile.venueCity || null,
      venueState: profile.venueState || null,
      venueZip: profile.venueZip || null,
      ceremonyTime: profile.ceremonyTime || null,
      receptionTime: profile.receptionTime || null,
      rsvpByDate: rsvpByDate || customization?.rsvpByDate || null,
    },
  };
}
