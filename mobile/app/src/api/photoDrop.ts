import { GuestPhotoDropSettings } from '../types';
import { mobileAuthJson } from './mobileAuth';

type GuestPhotoDropSettingsPatch = Partial<GuestPhotoDropSettings>;

export async function saveMobileGuestPhotoDropSettings(patch: GuestPhotoDropSettingsPatch) {
  const { selectedQrTarget: _selectedQrTarget, ...serverPatch } = patch;
  const result = await mobileAuthJson<{ settings: GuestPhotoDropSettings }>('/api/website/photo-drop/settings', {
    body: JSON.stringify(serverPatch),
    method: 'PUT',
  });
  return { ...result.settings, ...(patch.selectedQrTarget ? { selectedQrTarget: patch.selectedQrTarget } : {}) };
}
