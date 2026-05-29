import { mobileAuthJson } from './mobileAuth';

type ProfileResponse = {
  id: number;
};

type InvitationStudioPayload = {
  accent: string;
  background: 'blush' | 'ivory' | 'sage';
  designFont: 'playfair' | 'cormorant';
  designFontSize: number;
  includeHotel: boolean;
  rsvpBy: string;
  textColor: string;
};

function backgroundColor(background: InvitationStudioPayload['background']) {
  if (background === 'ivory') return '#FFFCF7';
  if (background === 'sage') return '#F6F8F1';
  return '#FFF7F2';
}

function fontFamily(font: InvitationStudioPayload['designFont']) {
  if (font === 'cormorant') return 'Cormorant Garamond';
  return 'Playfair Display';
}

export async function saveMobileInvitationStudio(payload: InvitationStudioPayload) {
  const profile = await mobileAuthJson<ProfileResponse>('/api/profile');
  const bg = backgroundColor(payload.background);
  const font = fontFamily(payload.designFont);
  return mobileAuthJson('/api/invitation-customizations', {
    body: JSON.stringify({
      profileId: profile.id,
      primaryColor: payload.accent,
      colorPalette: {
        primary: payload.accent,
        secondary: '#E6A6B7',
        accent: payload.accent,
        neutral: '#F2E2C6',
      },
      customColors: {
        saveTheDateAccent: payload.accent,
        digitalInvitationAccent: payload.accent,
        rsvpAskHotel: false,
        rsvpHotelBlockId: null,
        saveTheDateShowHotel: payload.includeHotel,
        saveTheDateHotelBlockId: 'all',
      },
      selectedPalette: null,
      saveTheDateBackground: bg,
      digitalInvitationBackground: bg,
      saveTheDateFont: font,
      digitalInvitationFont: font,
      saveTheDateFontColor: payload.textColor,
      digitalInvitationFontColor: payload.textColor,
      saveTheDateFontSize: String(payload.designFontSize),
      digitalInvitationFontSize: String(payload.designFontSize),
      saveTheDateAccentColor: payload.accent,
      digitalInvitationAccentColor: payload.accent,
      selectedLayout: 'classic',
      saveTheDateLayout: 'classic',
      digitalInvitationLayout: 'classic',
      useGeneratedInvitation: false,
      rsvpByDate: payload.rsvpBy || null,
    }),
    method: 'POST',
  });
}
