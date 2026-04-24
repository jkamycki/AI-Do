import { Router, type IRouter } from "express";

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

export default router;
