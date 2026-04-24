import { Router, raw } from "express";
import crypto from "node:crypto";
import { purgeUserData } from "../../lib/userCleanup";

const router = Router();

function verifyClerkWebhook(
  rawBody: string,
  headers: { svixId?: string; svixTimestamp?: string; svixSignature?: string },
): boolean {
  const secretFull = process.env.CLERK_WEBHOOK_SECRET;
  if (!secretFull) return false;
  if (!headers.svixId || !headers.svixTimestamp || !headers.svixSignature) return false;

  const ts = Number(headers.svixTimestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const secretB64 = secretFull.startsWith("whsec_") ? secretFull.slice(6) : secretFull;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(secretB64, "base64");
  } catch {
    return false;
  }

  const signedContent = `${headers.svixId}.${headers.svixTimestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  const candidates = headers.svixSignature.split(" ").map((s) => {
    const [, sig] = s.split(",");
    return sig ?? "";
  });

  const expectedBuf = Buffer.from(expected);
  return candidates.some((sig) => {
    if (!sig) return false;
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}

interface ClerkUserDeletedEvent {
  type: "user.deleted";
  data: { id?: string; deleted?: boolean };
}

interface ClerkEmailAddress {
  id?: string;
  email_address?: string;
}

interface ClerkUserEvent {
  type: string;
  data: {
    id?: string;
    primary_email_address_id?: string | null;
    email_addresses?: ClerkEmailAddress[];
    deleted?: boolean;
  };
}

router.post("/webhooks/clerk", raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
  const rawBody = (req.body as Buffer).toString("utf8");

  const ok = verifyClerkWebhook(rawBody, {
    svixId: req.header("svix-id") ?? undefined,
    svixTimestamp: req.header("svix-timestamp") ?? undefined,
    svixSignature: req.header("svix-signature") ?? undefined,
  });

  if (!ok) {
    req.log.warn("Clerk webhook signature invalid or missing CLERK_WEBHOOK_SECRET");
    res.status(401).json({ error: "invalid signature" });
    return;
  }

  let event: ClerkUserEvent;
  try {
    event = JSON.parse(rawBody) as ClerkUserEvent;
  } catch {
    res.status(400).json({ error: "invalid json" });
    return;
  }

  if (event.type === "user.deleted") {
    const deletedEvent = event as ClerkUserDeletedEvent;
    const userId = deletedEvent.data.id;
    if (!userId) {
      res.status(400).json({ error: "missing user id" });
      return;
    }
    try {
      await purgeUserData(userId, null);
      req.log.info({ userId }, "Clerk user.deleted: purged DB rows");
    } catch (err) {
      req.log.error({ err, userId }, "Failed to purge data on user.deleted");
      res.status(500).json({ error: "purge failed" });
      return;
    }
  }

  res.json({ received: true });
});

export default router;
