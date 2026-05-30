import { GuestPhotoDropSettings, GuestPhotoUpload } from '../types';
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

type ApiPhotoUpload = {
  caption?: string | null;
  guestEmail?: string | null;
  id: number | string;
  imageUrl?: string | null;
  note?: string | null;
  originalName?: string | null;
  publicImageUrl?: string | null;
  status?: string | null;
  uploadedAt?: string | null;
  guestName?: string | null;
};

function disposableCameraUrl(publicUploadUrl: string) {
  return publicUploadUrl.replace(/\/photo-drop\/([^/?#]+)([?#].*)?$/, '/wedding/$1/disposable$2');
}

function toMobileUpload(upload: ApiPhotoUpload): GuestPhotoUpload {
  const status = upload.status === 'approved' ? 'Approved' : upload.status === 'hidden' ? 'Hidden' : 'Pending';
  return {
    caption: upload.caption ?? upload.note ?? '',
    guestEmail: upload.guestEmail || undefined,
    guestName: upload.guestName || 'Guest upload',
    id: String(upload.id),
    imageUrl: upload.imageUrl || undefined,
    originalName: upload.originalName || undefined,
    publicImageUrl: upload.publicImageUrl || undefined,
    photoCount: 1,
    status,
    uploadedAt: upload.uploadedAt || new Date().toISOString(),
  };
}

export async function listMobileGuestPhotoDrop() {
  const result = await mobileAuthJson<{
    publicUploadUrl?: string;
    settings: GuestPhotoDropSettings;
    uploads: ApiPhotoUpload[];
  }>('/api/website/photo-drop');
  return {
    publicUploadUrl: result.publicUploadUrl ? disposableCameraUrl(result.publicUploadUrl) : '',
    settings: result.settings,
    uploads: result.uploads.map(toMobileUpload),
  };
}

export async function updateMobileGuestPhotoUploadStatus(uploadId: string, status: GuestPhotoUpload['status']) {
  const apiStatus = status === 'Approved' ? 'approved' : status === 'Hidden' ? 'hidden' : 'pending';
  const result = await mobileAuthJson<{ upload: ApiPhotoUpload }>(`/api/website/photo-drop/uploads/${uploadId}`, {
    body: JSON.stringify({ status: apiStatus }),
    method: 'PUT',
  });
  return toMobileUpload(result.upload);
}
