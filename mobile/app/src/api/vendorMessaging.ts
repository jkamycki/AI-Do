import { mobileAuthJson } from './mobileAuth';

type VendorConversation = {
  id: number;
  inboundAddress?: string;
  subject?: string;
  unreadCount?: number;
  vendorCategory?: string;
  vendorEmail?: string | null;
  vendorId: number;
  vendorName: string;
};

type VendorMessage = {
  body: string;
  conversationId: number;
  createdAt: string;
  deliveryStatus: 'failed' | 'queued' | 'sent' | string;
  errorMessage?: string | null;
  id: number;
  senderEmail?: string | null;
  senderName?: string | null;
  senderType: 'couple' | 'vendor' | 'system' | string;
  subject?: string | null;
};

function toBackendVendorId(vendorId: string | number) {
  const id = typeof vendorId === 'number' ? vendorId : Number(String(vendorId).replace(/^vendor-/, ''));
  if (!Number.isFinite(id) || id <= 0) throw new Error('This vendor must be synced before messages can be sent.');
  return id;
}

export async function getOrCreateMobileVendorConversation(vendorId: string | number) {
  const backendVendorId = toBackendVendorId(vendorId);
  return mobileAuthJson<VendorConversation>(`/api/messaging/conversations/by-vendor/${backendVendorId}`);
}

export async function listMobileVendorMessages(conversationId: number) {
  return mobileAuthJson<VendorMessage[]>(`/api/messaging/conversations/${conversationId}/messages`);
}

export async function sendMobileVendorMessage({
  body,
  cc,
  conversationId,
  subject,
}: {
  body: string;
  cc?: string[];
  conversationId: number;
  subject?: string;
}) {
  return mobileAuthJson<VendorMessage>(`/api/messaging/conversations/${conversationId}/messages`, {
    body: JSON.stringify({
      body,
      cc,
      subject,
    }),
    method: 'POST',
  });
}
