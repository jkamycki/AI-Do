import { getAuth, clerkClient } from "@clerk/express";
import { Request, Response, NextFunction } from "express";
import { db, deletedAccountEmails } from "@workspace/db";
import { inArray } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

const EMAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const emailCache = new Map<string, { emails: string[]; expiresAt: number }>();

export function invalidateUserEmailCache(userId: string): void {
  emailCache.delete(userId);
}

async function getUserEmailsCached(userId: string): Promise<string[]> {
  const cached = emailCache.get(userId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.emails;
  try {
    const u = await clerkClient.users.getUser(userId);
    const emails = (u.emailAddresses ?? [])
      .map((e) => e.emailAddress?.toLowerCase().trim())
      .filter((e): e is string => !!e);
    emailCache.set(userId, { emails, expiresAt: now + EMAIL_CACHE_TTL_MS });
    return emails;
  } catch {
    return [];
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const auth = getAuth(req);
  const userId =
    (auth?.sessionClaims?.userId as string | undefined) || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Server-side enforcement of the deleted-account email blocklist. A user
  // whose previous account was deleted cannot bypass the block by reusing a
  // valid Clerk session JWT — every authenticated request checks here.
  // Skip the unblock endpoint itself so it can clean up the blocked session.
  if (req.path !== "/auth/check-blocked") {
    try {
      const emails = await getUserEmailsCached(userId);
      if (emails.length > 0) {
        const hits = await db
          .select({ email: deletedAccountEmails.email })
          .from(deletedAccountEmails)
          .where(inArray(deletedAccountEmails.email, emails))
          .limit(1);
        if (hits.length > 0) {
          res.status(403).json({
            blocked: true,
            error:
              "This email address was previously deleted from A.IDO and cannot be used to create a new account.",
          });
          return;
        }
      }
    } catch (err) {
      // If the blocklist check itself errors, fail closed only if we got the
      // userId — but tolerate transient Clerk/DB hiccups by allowing through
      // and letting the periodic re-check on next request catch them.
      req.log?.warn({ err, userId }, "blocklist check failed; allowing request");
    }
  }

  req.userId = userId;
  next();
};
