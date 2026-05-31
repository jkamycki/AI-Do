import { mobileAuthFetch, mobileAuthJson } from './mobileAuth';
import type { DocumentItem } from '../types';

export type MobileDocumentRecord = {
  fileName?: string | null;
  fileType?: string | null;
  folder?: string | null;
  id: number;
  linkedVendorName?: string | null;
  originalFileName?: string | null;
  summary?: string | null;
  updatedAt?: string;
};

export async function listMobileDocuments() {
  const response = await mobileAuthJson<{ documents: MobileDocumentRecord[] }>('/api/documents');
  return response.documents;
}

export type MobilePickedFile = {
  file?: Blob;
  mimeType?: string | null;
  name: string;
  uri: string;
};

function appendPickedFile(form: FormData, pickedFile: MobilePickedFile) {
  if (pickedFile.file) {
    form.append('file', pickedFile.file, pickedFile.name);
    return;
  }

  form.append('file', {
    name: pickedFile.name,
    type: pickedFile.mimeType || 'application/octet-stream',
    uri: pickedFile.uri,
  } as unknown as Blob);
}

async function uploadForm<T>(path: string, form: FormData): Promise<T> {
  const response = await mobileAuthFetch(path, {
    body: form,
    method: 'POST',
  });
  if (!response) throw new Error('Sign in is required to upload files.');
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || 'Upload failed.');
  }
  return payload as T;
}

export async function uploadMobileDocument(pickedFile: MobilePickedFile, folder = 'Mobile Uploads') {
  const form = new FormData();
  appendPickedFile(form, pickedFile);
  form.append('folder', folder);
  return uploadForm<{ document: MobileDocumentRecord }>('/api/documents/upload', form);
}

export async function uploadMobileContract(pickedFile: MobilePickedFile, options: { displayName?: string; syncToDocumentLibrary?: boolean; vendorId?: number } = {}) {
  const form = new FormData();
  appendPickedFile(form, pickedFile);
  if (options.displayName?.trim()) form.append('displayName', options.displayName.trim());
  if (options.vendorId) form.append('vendorId', String(options.vendorId));
  form.append('syncToDocumentLibrary', options.syncToDocumentLibrary ? 'true' : 'false');
  return uploadForm('/api/contracts/upload', form);
}

export async function updateMobileDocumentStatus(documentId: string, status: DocumentItem['status']) {
  if (!/^\d+$/.test(documentId)) return { synced: false };
  const response = await mobileAuthFetch(`/api/documents/${documentId}`, {
    body: JSON.stringify({ mobileStatus: status }),
    method: 'PATCH',
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error('Could not update document status.');
  return { synced: true };
}
