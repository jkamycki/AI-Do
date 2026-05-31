import type { ContractItem } from '../types';
import { mobileAuthFetch, mobileAuthJson } from './mobileAuth';

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

export async function updateMobileContractStatus(contractId: string, status: ContractItem['status']) {
  if (!/^\d+$/.test(contractId)) return { synced: false };
  const response = await mobileAuthFetch(`/api/contracts/${contractId}`, {
    body: JSON.stringify({ mobileStatus: status }),
    method: 'PATCH',
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error('Could not update contract status.');
  return { synced: true };
}
