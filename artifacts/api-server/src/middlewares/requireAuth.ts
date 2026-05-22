import { getAuth } from "@clerk/express";
import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function secretsMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const loadTestSecret = process.env["LOAD_TEST_SECRET"];
  const loadTestUserId = headerValue(req.headers["x-aido-load-test-user-id"]);
  const loadTestHeader = headerValue(req.headers["x-aido-load-test-secret"]);
  if (
    process.env["LOAD_TEST_MODE"] === "true" &&
    loadTestSecret &&
    loadTestHeader &&
    loadTestUserId &&
    loadTestUserId.startsWith("user_") &&
    secretsMatch(loadTestHeader, loadTestSecret)
  ) {
    req.userId = loadTestUserId;
    next();
    return;
  }

  const auth = getAuth(req);
  // SECURITY: prefer auth.userId — Clerk's canonical, JWT-subject-bound user
  // id for the current session. Reading sessionClaims.userId first (the old
  // behavior) made the request identify as whatever a custom JWT-template
  // claim resolved to, which can be stale or hardcoded in public_metadata
  // and produced a cross-account data leak (one user's data appearing under
  // another user's session). sessionClaims.userId is only used as a fallback
  // in the unlikely case Clerk omits userId from the auth object.
  const userId =
    (typeof auth?.userId === "string" && auth.userId) ||
    (typeof auth?.sessionClaims?.userId === "string"
      ? (auth.sessionClaims.userId as string)
      : undefined);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
};
