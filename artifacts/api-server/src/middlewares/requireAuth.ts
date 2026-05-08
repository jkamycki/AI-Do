import { getAuth } from "@clerk/express";
import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
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
