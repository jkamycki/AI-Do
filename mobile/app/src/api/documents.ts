import { mobileAuthJson } from './mobileAuth';

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
