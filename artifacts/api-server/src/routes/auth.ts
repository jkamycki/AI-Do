import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/auth/signup", async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ error: "Auth not configured" });
    }
    const r = await fetch("https://api.clerk.com/v1/users", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: [email.trim()],
        password,
        first_name: typeof firstName === "string" ? firstName.trim() || undefined : undefined,
        last_name: typeof lastName === "string" ? lastName.trim() || undefined : undefined,
        skip_password_checks: true,
        skip_password_requirement: false,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg =
        (data?.errors?.[0]?.long_message as string) ||
        (data?.errors?.[0]?.message as string) ||
        "Failed to create account";
      return res.status(r.status).json({ error: msg });
    }
    return res.json({ ok: true, userId: data?.id });
  } catch (err) {
    req.log?.error(err, "signup failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
