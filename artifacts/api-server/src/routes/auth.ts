import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { db, deletedAccountEmails } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { purgeUserData } from "../lib/userCleanup";

const router: IRouter = Router();

const CLERK_API = "https://api.clerk.com/v1";

async function isEmailBlocked(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const [row] = await db
    .select()
    .from(deletedAccountEmails)
    .where(eq(deletedAccountEmails.email, normalized))
    .limit(1);
  return !!row;
}

function getSecret(res: import("express").Response): string | null {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: "Auth not configured" });
    return null;
  }
  return secretKey;
}

router.post("/auth/signup", async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (await isEmailBlocked(email)) {
      return res.status(409).json({ error: "This email address was previously deleted from A.IDO and cannot be used to create a new account. Please contact support if you believe this is in error." });
    }
    const secretKey = getSecret(res);
    if (!secretKey) return;

    const createRes = await fetch(`${CLERK_API}/users`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email_address: [email.trim()],
        password,
        first_name: typeof firstName === "string" ? firstName.trim() || undefined : undefined,
        last_name: typeof lastName === "string" ? lastName.trim() || undefined : undefined,
        skip_password_checks: true,
        skip_password_requirement: false,
      }),
    });
    const createData = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      const msg =
        (createData?.errors?.[0]?.long_message as string) ||
        (createData?.errors?.[0]?.message as string) ||
        "Failed to create account";
      return res.status(createRes.status).json({ error: msg });
    }

    const userId: string | undefined = createData?.id;
    const emailAddresses: Array<{ id: string; email_address: string }> = createData?.email_addresses ?? [];
    const emailObj = emailAddresses.find((e) => e.email_address?.toLowerCase() === email.trim().toLowerCase()) || emailAddresses[0];
    const emailAddressId = emailObj?.id;

    if (emailAddressId) {
      await fetch(`${CLERK_API}/email_addresses/${emailAddressId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ verified: true }),
      }).catch(() => {});
    }

    let signInToken: string | null = null;
    if (userId) {
      const tokenRes = await fetch(`${CLERK_API}/sign_in_tokens`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, expires_in_seconds: 600 }),
      });
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (tokenRes.ok && typeof tokenData?.token === "string") {
        signInToken = tokenData.token;
      } else {
        req.log?.warn({ tokenData }, "sign_in_token creation failed");
      }
    }

    return res.json({ ok: true, userId, signInToken });
  } catch (err) {
    req.log?.error(err, "signup failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/verify", async (req, res) => {
  try {
    const { emailAddressId, code } = req.body ?? {};
    if (typeof emailAddressId !== "string" || typeof code !== "string" || !emailAddressId || !code) {
      return res.status(400).json({ error: "Verification code is required" });
    }
    const secretKey = getSecret(res);
    if (!secretKey) return;

    const verifyRes = await fetch(`${CLERK_API}/email_addresses/${emailAddressId}/attempt_verification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    const data = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok) {
      const msg =
        (data?.errors?.[0]?.long_message as string) ||
        (data?.errors?.[0]?.message as string) ||
        "Invalid or expired code";
      return res.status(verifyRes.status).json({ error: msg });
    }
    return res.json({ ok: true });
  } catch (err) {
    req.log?.error(err, "verify failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/resend", async (req, res) => {
  try {
    const { emailAddressId } = req.body ?? {};
    if (typeof emailAddressId !== "string" || !emailAddressId) {
      return res.status(400).json({ error: "Missing email address id" });
    }
    const secretKey = getSecret(res);
    if (!secretKey) return;

    const prepRes = await fetch(`${CLERK_API}/email_addresses/${emailAddressId}/prepare_verification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ strategy: "email_code" }),
    });
    if (!prepRes.ok) {
      const data = await prepRes.json().catch(() => ({}));
      const msg = (data?.errors?.[0]?.long_message as string) || "Could not resend code";
      return res.status(prepRes.status).json({ error: msg });
    }
    return res.json({ ok: true });
  } catch (err) {
    req.log?.error(err, "resend failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/check-blocked", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await clerkClient.users.getUser(userId);
    const emails = (user.emailAddresses ?? []).map(e => e.emailAddress).filter(Boolean) as string[];
    if (user.primaryEmailAddressId) {
      const primary = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId);
      if (primary?.emailAddress) emails.unshift(primary.emailAddress);
    }
    let blocked = false;
    for (const e of emails) {
      if (await isEmailBlocked(e)) { blocked = true; break; }
    }
    if (blocked) {
      const primaryEmail = emails[0] ?? null;
      await purgeUserData(userId, primaryEmail).catch((err) => {
        req.log?.error(err, "purge after blocked re-signup failed");
      });
      await clerkClient.users.deleteUser(userId).catch((err) => {
        req.log?.error(err, "clerk delete after blocked re-signup failed");
      });
      return res.status(403).json({ blocked: true, error: "This email address was previously deleted from A.IDO and cannot be used to create a new account." });
    }
    return res.json({ blocked: false });
  } catch (err) {
    req.log?.error(err, "check-blocked failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
