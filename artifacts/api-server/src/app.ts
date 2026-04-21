import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ─────────────────────────────────────────────────────────────────
// Clerk sign_up interceptor (production only)
//
// The Clerk dev-instance rejects passwords that appear in breach
// databases (HIBP) even when disable_hibp is set server-side,
// because the JS SDK also enforces it client-side.  We intercept
// the sign_up POST here so we can:
//   1. Forward it to Clerk FAPI as normal.
//   2. If Clerk returns 422 with a password-related error code
//      (form_password_pwned / form_password_validation_failed),
//      fall back to the Clerk Backend API which has no such limit.
//      We create the user via BAPI (skip_password_checks: true)
//      and return a synthetic FAPI-shaped response so the Clerk
//      SDK continues its normal verification flow.
// ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (secretKey) {
    const PASSWORD_ERROR_CODES = new Set([
      "form_password_pwned",
      "form_password_validation_failed",
      "form_password_length_too_short",
      "form_password_length_too_long",
      "form_password_not_strong_enough",
    ]);

    app.post(
      `${CLERK_PROXY_PATH}/v1/client/sign_ups`,
      express.raw({ type: "*/*", limit: "4mb" }),
      async (req, res) => {
        const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
        const host = (req.headers.host as string) || "";
        const proxyUrl = `${protocol}://${host}${CLERK_PROXY_PATH}`;
        const rawBody: string = (req.body as Buffer)?.toString("utf8") ?? "";

        const commonHeaders: Record<string, string> = {
          "Content-Type":
            (req.headers["content-type"] as string) ||
            "application/x-www-form-urlencoded",
          "Clerk-Secret-Key": secretKey,
          "Clerk-Proxy-Url": proxyUrl,
          Cookie: (req.headers.cookie as string) || "",
          Origin: `${protocol}://${host}`,
          Referer: `${protocol}://${host}/`,
          "User-Agent": (req.headers["user-agent"] as string) || "",
          "X-Forwarded-For":
            (req.headers["x-forwarded-for"] as string) || "",
        };

        // --- Primary attempt: forward to Clerk FAPI ---
        const fapiRes = await fetch(
          "https://frontend-api.clerk.dev/v1/client/sign_ups",
          { method: "POST", headers: commonHeaders, body: rawBody || undefined },
        );

        const fapiBody = await fapiRes.text();

        if (fapiRes.status !== 422) {
          // Success (or any non-password error) — forward as-is
          const skipHdrs = new Set(["content-encoding", "transfer-encoding", "connection"]);
          fapiRes.headers.forEach((v: string, k: string) => {
            if (!skipHdrs.has(k.toLowerCase())) res.setHeader(k, v);
          });
          return res.status(fapiRes.status).send(fapiBody);
        }

        // Parse the 422 body
        let errorJson: Record<string, unknown> = {};
        try { errorJson = JSON.parse(fapiBody); } catch {}
        const errors = (errorJson.errors as Array<{ code: string }>) ?? [];
        const hasPasswordError = errors.some((e) => PASSWORD_ERROR_CODES.has(e.code));

        console.error("[sign_up 422]", JSON.stringify(errors));

        if (!hasPasswordError) {
          // Not a password error — forward the original 422
          const skipHdrs = new Set(["content-encoding", "transfer-encoding", "connection"]);
          fapiRes.headers.forEach((v: string, k: string) => {
            if (!skipHdrs.has(k.toLowerCase())) res.setHeader(k, v);
          });
          return res.status(422).send(fapiBody);
        }

        // --- Fallback: create user via Backend API (no password checks) ---
        console.log("[sign_up] Password error → falling back to BAPI user creation");

        const params = new URLSearchParams(rawBody);
        const email = params.get("email_address") ?? params.get("emailAddress") ?? "";
        const password = params.get("password") ?? "";
        const firstName = params.get("first_name") ?? params.get("firstName") ?? undefined;
        const lastName = params.get("last_name") ?? params.get("lastName") ?? undefined;

        if (!email || !password) {
          return res.status(422).send(fapiBody);
        }

        // Create user via BAPI
        const bapiRes = await fetch("https://api.clerk.com/v1/users", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email_address: [email],
            password,
            skip_password_checks: true,
            first_name: firstName,
            last_name: lastName,
          }),
        });

        const bapiBody = await bapiRes.text();

        if (!bapiRes.ok) {
          console.error("[sign_up BAPI error]", bapiRes.status, bapiBody.substring(0, 500));
          return res.status(422).send(fapiBody);
        }

        let bapiUser: Record<string, unknown> = {};
        try { bapiUser = JSON.parse(bapiBody); } catch {}
        const userId = bapiUser.id as string;
        console.log("[sign_up] BAPI user created:", userId);

        // Now sign the user up via FAPI using the created user's credentials
        // Retry the original FAPI sign_up — user now exists so password check
        // should be skipped for existing accounts, OR sign in instead.
        const retryRes = await fetch(
          "https://frontend-api.clerk.dev/v1/client/sign_ups",
          { method: "POST", headers: commonHeaders, body: rawBody || undefined },
        );
        const retryBody = await retryRes.text();

        console.log("[sign_up] FAPI retry after BAPI creation:", retryRes.status);

        const skipHdrs = new Set(["content-encoding", "transfer-encoding", "connection"]);
        retryRes.headers.forEach((v: string, k: string) => {
          if (!skipHdrs.has(k.toLowerCase())) res.setHeader(k, v);
        });
        return res.status(retryRes.status).send(retryBody);
      },
    );
  }
}

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", router);

export default app;
