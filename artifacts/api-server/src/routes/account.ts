import { Router } from "express";
import { clerkClient } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth";
import { blockEmailsForUser, purgeUserData, snapshotUserData } from "../lib/userCleanup";

const router = Router();

async function getUserDeletionContext(userId: string): Promise<{
  emails: string[];
  firstName: string | null;
  lastName: string | null;
}> {
  try {
    const u = await clerkClient.users.getUser(userId);
    return {
      emails: (u.emailAddresses ?? [])
        .map((e) => e.emailAddress?.toLowerCase().trim())
        .filter((e): e is string => !!e),
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
    };
  } catch {
    return { emails: [], firstName: null, lastName: null };
  }
}

router.delete("/account", requireAuth, async (req, res) => {
  const userId = req.userId!;

  try {
    const userContext = await getUserDeletionContext(userId);
    await snapshotUserData(userId, {
      email: userContext.emails[0] ?? null,
      firstName: userContext.firstName,
      lastName: userContext.lastName,
    });
    await blockEmailsForUser(userContext.emails, userId);
    await purgeUserData(userId, userContext.emails);
    await clerkClient.users.deleteUser(userId);
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete account");
    res.status(500).json({ error: "Failed to delete account. Please try again." });
  }
});

export default router;
