import { Router } from "express";
import { clerkClient } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth";
import { purgeUserData } from "../lib/userCleanup";

const router = Router();

async function getAllUserEmailsLower(userId: string): Promise<string[]> {
  try {
    const u = await clerkClient.users.getUser(userId);
    return (u.emailAddresses ?? [])
      .map((e) => e.emailAddress?.toLowerCase().trim())
      .filter((e): e is string => !!e);
  } catch {
    return [];
  }
}

router.delete("/account", requireAuth, async (req, res) => {
  const userId = req.userId!;

  try {
    const userEmails = await getAllUserEmailsLower(userId);
    await purgeUserData(userId, userEmails);
    await clerkClient.users.deleteUser(userId);
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to delete account");
    res.status(500).json({ error: "Failed to delete account. Please try again." });
  }
});

export default router;
