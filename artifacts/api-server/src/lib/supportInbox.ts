import { db } from "@workspace/db";
import { contactMessages } from "@workspace/db/schema";

const DEFAULT_SUPPORT_INBOX = "support@aidowedding.net";

function parseAddressList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function getSupportInboxAddresses(): string[] {
  const fromEnv = parseAddressList(process.env.SUPPORT_INBOX_EMAILS);
  if (fromEnv.length > 0) return fromEnv;
  return [DEFAULT_SUPPORT_INBOX];
}

export function isSupportInboxRecipient(addresses: string[]): boolean {
  if (addresses.length === 0) return false;
  const inbox = new Set(getSupportInboxAddresses());
  return addresses.some((a) => {
    const norm = a.trim().toLowerCase();
    return norm.length > 0 && inbox.has(norm);
  });
}

export async function saveSupportInboxMessage(args: {
  fromEmail: string;
  fromName?: string | null;
  subject?: string | null;
  body?: string | null;
}): Promise<{ id: number } | null> {
  const email = (args.fromEmail || "").trim().toLowerCase();
  if (!email) return null;
  const name = (args.fromName || "").trim() || email;
  const subject = (args.subject || "").trim() || "(no subject)";
  const message = (args.body || "").trim() || "(empty message)";

  const [saved] = await db
    .insert(contactMessages)
    .values({
      userId: null,
      name,
      email,
      subject,
      message,
    })
    .returning({ id: contactMessages.id });

  return saved ? { id: saved.id } : null;
}
