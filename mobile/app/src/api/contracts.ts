import { mobileAuthJson } from './mobileAuth';

export type MobileContractRecord = {
  analysis?: {
    clauses?: unknown[];
    keyTerms?: unknown[];
    redFlags?: unknown[];
    riskLevel?: string;
    summary?: string;
  } | null;
  createdAt: string;
  fileName: string;
  fileSize?: number | null;
  hotelName?: string | null;
  id: number;
  vendorName?: string | null;
};

export async function listMobileContracts() {
  return mobileAuthJson<MobileContractRecord[]>('/api/contracts');
}
