import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { testSigninLimiter } from "../middlewares/rateLimiter";

const router: IRouter = Router();

// The previous custom backend signup endpoints (POST /auth/signup, /auth/verify,
// /auth/resend) created users via the Clerk Backend API and force-marked their
// email as verified, which allowed creating accounts for arbitrary emails the
// requester did not own. Signup is now done entirely via Clerk's frontend SDK
// (signUp.create + prepareEmailAddressVerification + attemptEmailAddressVerification),
// where the email-verification code proves ownership before any session is issued.
//
// These routes are kept here as 410 Gone so any stale clients fail loudly
// instead of silently behaving in a confusing way.

const gone: import("express").RequestHandler = (_req, res) => {
  res.status(410).json({
    error:
      "This endpoint has been removed. Sign-up now happens entirely on the client via Clerk.",
  });
};

router.post("/auth/signup", gone);
router.post("/auth/verify", gone);
router.post("/auth/resend", gone);

// ─────────────────────────────────────────────────────────────────
// POST /auth/test-signin
//
// Issues a one-shot Clerk sign-in token for a fixed test account so the
// owner can repeatedly sign in with one click without going through the
// email-code verification on every visit. The account is a real Clerk
// user that persists data normally — it's just always the same identity.
//
// Disabled by default. Set `ENABLE_TEST_ACCOUNT=true` in env to turn it
// on. The test email defaults to "test@aidowedding.net" and can be
// overridden with `TEST_ACCOUNT_EMAIL`.
// ─────────────────────────────────────────────────────────────────
router.post("/auth/test-signin", testSigninLimiter, async (_req, res) => {
  if (process.env["ENABLE_TEST_ACCOUNT"] !== "true") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const secretKey = process.env["CLERK_SECRET_KEY"];
  if (!secretKey) {
    res.status(500).json({ error: "Clerk is not configured." });
    return;
  }
  const testEmail =
    process.env["TEST_ACCOUNT_EMAIL"]?.trim() || "test@aidowedding.net";

  const bapi = (
    path: string,
    init?: { method?: "GET" | "POST"; body?: unknown },
  ) =>
    fetch(`https://api.clerk.com${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

  try {
    // Step 1: find or create the test user.
    const findRes = await bapi(
      `/v1/users?email_address=${encodeURIComponent(testEmail)}`,
    );
    if (!findRes.ok) {
      const detail = (await findRes.text()).slice(0, 300);
      logger.warn({ status: findRes.status, detail }, "test-signin: lookup failed");
      res.status(502).json({ error: "Could not query Clerk." });
      return;
    }
    const found = (await findRes.json()) as Array<{ id?: string }> | unknown;
    let userId: string | null =
      Array.isArray(found) && found[0]?.id ? found[0].id : null;

    if (!userId) {
      const createRes = await bapi("/v1/users", {
        method: "POST",
        body: {
          email_address: [testEmail],
          first_name: "Test",
          last_name: "Account",
          skip_password_requirement: true,
        },
      });
      if (!createRes.ok) {
        const detail = (await createRes.text()).slice(0, 300);
        logger.warn({ status: createRes.status, detail }, "test-signin: create failed");
        res.status(502).json({ error: "Could not create test user." });
        return;
      }
      const created = (await createRes.json()) as { id?: string };
      userId = created?.id ?? null;
    }

    if (!userId) {
      res.status(500).json({ error: "No user id available." });
      return;
    }

    // Step 2: mint a short-lived sign-in token. The frontend will consume
    // it via signIn.create({ strategy: "ticket", ticket }).
    const tokenRes = await bapi("/v1/sign_in_tokens", {
      method: "POST",
      body: { user_id: userId, expires_in_seconds: 300 },
    });
    if (!tokenRes.ok) {
      const detail = (await tokenRes.text()).slice(0, 300);
      logger.warn({ status: tokenRes.status, detail }, "test-signin: token failed");
      res.status(502).json({ error: "Could not issue sign-in token." });
      return;
    }
    const tokenJson = (await tokenRes.json()) as { token?: string };
    const token = tokenJson?.token;
    if (!token) {
      res.status(500).json({ error: "No token returned by Clerk." });
      return;
    }

    res.json({ token });
  } catch (err) {
    logger.warn({ err }, "test-signin: unexpected error");
    res.status(500).json({ error: "Test sign-in failed." });
  }
});

export default router;
