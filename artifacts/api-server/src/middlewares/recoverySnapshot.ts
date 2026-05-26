import type { NextFunction, Request, Response } from "express";
import { createWorkspaceRecoverySnapshot } from "../lib/accountRecovery";
import { resolveProfile } from "../lib/workspaceAccess";

const SKIP_PATH_PARTS = [
  "/account/recovery",
  "/admin",
  "/analytics",
  "/health",
  "/track",
  "/website/public",
  "/invitation-shares",
];

function shouldSkip(path: string) {
  return SKIP_PATH_PARTS.some((part) => path.includes(part));
}

export async function preDeleteRecoverySnapshot(req: Request, _res: Response, next: NextFunction) {
  if (req.method !== "DELETE" || !req.userId || shouldSkip(req.path)) {
    next();
    return;
  }

  try {
    const profile = await resolveProfile(req);
    if (profile) {
      await createWorkspaceRecoverySnapshot(
        profile.id,
        req.userId,
        `Before ${req.method} ${req.path}`,
        "pre_delete_recovery",
      );
    }
  } catch (err) {
    req.log?.warn({ err, path: req.path }, "Pre-delete recovery snapshot failed");
  }

  next();
}
