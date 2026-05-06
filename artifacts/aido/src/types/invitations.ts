export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
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
  selectedLayout: string;
  saveTheDateLayout?: string;
  digitalInvitationLayout?: string;
  backgroundImageUrl: string | null;
  saveTheDateBackground?: string | null;
  digitalInvitationBackground?: string | null;
  textOverrides?: TextOverrides;
  useGeneratedInvitation?: boolean;
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
