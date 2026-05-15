export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  // Per-invitation accent backup stored in customColors JSONB so the send
  // modal shows independent accents even before the dedicated DB columns exist.
  saveTheDateAccent?: string;
  digitalInvitationAccent?: string;
  saveTheDatePhotoEffect?: string;
  digitalInvitationPhotoEffect?: string;
}

export interface ElementOverride {
  x?: number;
  y?: number;
  font?: string;
  color?: string;
  fontSize?: number;
  objectX?: number;
  objectY?: number;
  text?: string;
}

export type TextOverrides = Record<string, ElementOverride>;

export interface InvitationCustomization {
  id?: number;
  profileId: number;
  primaryColor: string;
  colorPalette: ColorPalette;
  customColors: Partial<ColorPalette> | null;
  selectedPalette: string | null;
  backgroundColor: string | null;
  saveTheDatePhotoUrl: string | null;
  digitalInvitationPhotoUrl: string | null;
  saveTheDatePhotoPosition?: { x: number; y: number } | null;
  digitalInvitationPhotoPosition?: { x: number; y: number } | null;
  selectedFont: string;
  saveTheDateFont?: string;
  digitalInvitationFont?: string;
  saveTheDateFontColor?: string | null;
  digitalInvitationFontColor?: string | null;
  saveTheDateFontSize?: string | null;
  digitalInvitationFontSize?: string | null;
  saveTheDateAccentColor?: string | null;
  digitalInvitationAccentColor?: string | null;
  selectedLayout: string;
  saveTheDateLayout?: string;
  digitalInvitationLayout?: string;
  backgroundImageUrl: string | null;
  saveTheDateBackground?: string | null;
  digitalInvitationBackground?: string | null;
  textOverrides?: TextOverrides;
  useGeneratedInvitation?: boolean;
  // Couple-set RSVP deadline (YYYY-MM-DD) shown on the RSVP invitation
  // preview, email, and public RSVP page.
  rsvpByDate?: string | null;
  updatedAt?: string;
  createdAt?: string;
}

export interface WeddingProfileData {
  id: number;
  partner1Name: string;
  partner2Name: string;
  weddingDate: string;
  ceremonyTime: string;
  receptionTime: string;
  venue: string;
  location: string;
  venueCity?: string;
  venueState?: string;
  venueZip?: string;
  saveTheDateMessage?: string;
  invitationMessage?: string;
}

export type PreviewTab = "saveTheDate" | "digitalInvitation";

export interface ColorGenerationResponse {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
}
