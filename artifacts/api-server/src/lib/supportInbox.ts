import { db } from "@workspace/db";
import { contactMessages, contactMessageReplies } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "crypto";

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

function getSupportInboxDomain(): string {
  const first = getSupportInboxAddresses()[0] ?? DEFAULT_SUPPORT_INBOX;
  const at = first.indexOf("@");
  return at >= 0 ? first.slice(at + 1) : "aidowedding.net";
}

function getSupportInboxLocal(): string {
  const first = getSupportInboxAddresses()[0] ?? DEFAULT_SUPPORT_INBOX;
  const at = first.indexOf("@");
  return at >= 0 ? first.slice(0, at) : "support";
}

export function buildSupportThreadAddress(contactMessageId: number, token: string): string {
  return `${getSupportInboxLocal()}+t.${contactMessageId}.${token}@${getSupportInboxDomain()}`;
}

export function parseSupportThreadAddress(addr: string): { contactMessageId: number; token: string } | null {
  if (!addr) return null;
  const norm = addr.trim().toLowerCase();
  const at = norm.indexOf("@");
  if (at < 0) return null;
  const local = norm.slice(0, at);
  const domain = norm.slice(at + 1);
  if (domain !== getSupportInboxDomain().toLowerCase()) return null;
  const expectedLocal = getSupportInboxLocal().toLowerCase();
  if (!local.startsWith(`${expectedLocal}+t.`)) return null;
  const rest = local.slice(expectedLocal.length + 3);
  const dot = rest.indexOf(".");
  if (dot <= 0) return null;
  const idStr = rest.slice(0, dot);
  const token = rest.slice(dot + 1);
  const id = Number.parseInt(idStr, 10);
  if (!Number.isFinite(id) || id <= 0 || !token) return null;
  return { contactMessageId: id, token };
}

export function generateThreadToken(): string {
  return randomBytes(12).toString("hex");
}

export async function ensureContactThreadToken(contactMessageId: number): Promise<string | null> {
  const [row] = await db
    .select({ id: contactMessages.id, threadToken: contactMessages.threadToken })
    .from(contactMessages)
    .where(eq(contactMessages.id, contactMessageId))
    .limit(1);
  if (!row) return null;
  if (row.threadToken) return row.threadToken;
  const token = generateThreadToken();
  await db
    .update(contactMessages)
    .set({ threadToken: token })
    .where(eq(contactMessages.id, contactMessageId));
  return token;
}

export async function appendInboundReply(args: {
  contactMessageId: number;
  token: string;
  fromEmail: string;
  fromName?: string | null;
  body?: string | null;
}): Promise<{ id: number } | null> {
  const email = (args.fromEmail || "").trim().toLowerCase();
  if (!email) return null;
  const [parent] = await db
    .select({ id: contactMessages.id, threadToken: contactMessages.threadToken })
    .from(contactMessages)
    .where(and(eq(contactMessages.id, args.contactMessageId), eq(contactMessages.threadToken, args.token)))
    .limit(1);
  if (!parent) return null;
  const body = (args.body || "").trim() || "(empty message)";
  const [saved] = await db
    .insert(contactMessageReplies)
    .values({
      contactMessageId: parent.id,
      direction: "inbound",
      body,
      senderUserId: null,
      senderEmail: email,
      senderName: (args.fromName || "").trim() || null,
    })
    .returning({ id: contactMessageReplies.id });
  await db
    .update(contactMessages)
    .set({ isRead: false, isResolved: false })
    .where(eq(contactMessages.id, parent.id));
  return saved ? { id: saved.id } : null;
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
