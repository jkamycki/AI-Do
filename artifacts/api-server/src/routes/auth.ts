import { Router, type IRouter } from "express";

const router: IRouter = Router();

const CLERK_API = "https://api.clerk.com/v1";

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

    if (!userId || !emailAddressId) {
      return res.status(500).json({ error: "Account created but verification could not be initialized" });
    }

    const prepRes = await fetch(`${CLERK_API}/email_addresses/${emailAddressId}/prepare_verification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ strategy: "email_code" }),
    });
    if (!prepRes.ok) {
      const prepData = await prepRes.json().catch(() => ({}));
      const msg =
        (prepData?.errors?.[0]?.long_message as string) ||
        (prepData?.errors?.[0]?.message as string) ||
        "Could not send verification email";
      return res.status(prepRes.status).json({ error: msg });
    }

    return res.json({ ok: true, userId, emailAddressId });
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

export default router;
