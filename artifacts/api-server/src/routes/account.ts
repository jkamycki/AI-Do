import { Router } from "express";
import { clerkClient } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth";
import { purgeUserData } from "../lib/userCleanup";

const router = Router();

async function getUserEmailLower(userId: string): Promise<string | null> {
  try {
    const u = await clerkClient.users.getUser(userId);
    const primaryId = u.primaryEmailAddressId;
    const primary =
      u.emailAddresses.find((e) => e.id === primaryId) ?? u.emailAddresses[0];
    return primary?.emailAddress?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

router.delete("/account", requireAuth, async (req, res) => {
  const userId = req.userId!;

  try {
    const userEmail = await getUserEmailLower(userId);
    await purgeUserData(userId, userEmail);
    await clerkClient.users.deleteUser(userId);
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete account");
    res.status(500).json({ error: "Failed to delete account. Please try again." });
  }
});

export default router;
