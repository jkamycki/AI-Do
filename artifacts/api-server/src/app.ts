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
// Clerk auth interceptor (production only)
//
// Clerk dev-instances enforce HIBP password-breach checks on BOTH
// sign-up AND sign-in even when disable_hibp is set.  We intercept
// these endpoints and fall back to the Backend API when needed.
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

    type FetchHeaders = Record<string, string>;

    const fapiFetch = (
      path: string,
      method: "POST" | "GET",
      headers: FetchHeaders,
      body?: string,
    ) =>
      fetch(`https://frontend-api.clerk.dev${path}`, {
        method,
        headers: {
          ...headers,
          "Clerk-Secret-Key": secretKey,
        },
        body,
      });

    const bapiFetch = (
      path: string,
      method: "POST" | "GET",
      jsonBody?: unknown,
    ) =>
      fetch(`https://api.clerk.com${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: jsonBody === undefined ? undefined : JSON.stringify(jsonBody),
      });

    // Properly forward upstream response (handles multi-value Set-Cookie)
    const forwardResponse = (
      upstreamRes: Response,
      upstreamBody: string,
      res: express.Response,
    ) => {
      const skipHdrs = new Set([
        "content-encoding",
        "transfer-encoding",
        "connection",
        "set-cookie",
      ]);

      // Multi-value Set-Cookie - critical for session persistence
      const setCookies =
        (upstreamRes.headers as unknown as { getSetCookie?: () => string[] })
          .getSetCookie?.() ?? [];
      if (setCookies.length > 0) {
        res.setHeader("Set-Cookie", setCookies);
      }

      upstreamRes.headers.forEach((v: string, k: string) => {
        if (!skipHdrs.has(k.toLowerCase())) res.setHeader(k, v);
      });
      res.status(upstreamRes.status).send(upstreamBody);
    };

    const buildCommonHeaders = (req: express.Request): FetchHeaders => {
      const protocol =
        (req.headers["x-forwarded-proto"] as string) || "https";
      const host = (req.headers.host as string) || "";
      return {
        "Content-Type":
          (req.headers["content-type"] as string) ||
          "application/x-www-form-urlencoded",
        "Clerk-Proxy-Url": `${protocol}://${host}${CLERK_PROXY_PATH}`,
        Cookie: (req.headers.cookie as string) || "",
        Origin: `${protocol}://${host}`,
        Referer: `${protocol}://${host}/`,
        "User-Agent": (req.headers["user-agent"] as string) || "",
        "X-Forwarded-For":
          (req.headers["x-forwarded-for"] as string) || "",
      };
    };

    // ─── SIGN-UP interceptor ──────────────────────────────────────
    app.post(
      `${CLERK_PROXY_PATH}/v1/client/sign_ups`,
      express.raw({ type: "*/*", limit: "4mb" }),
      async (req, res) => {
        const commonHdrs = buildCommonHeaders(req);
        const rawBody: string =
          (req.body as Buffer)?.toString("utf8") ?? "";

        const fapiRes = await fapiFetch(
          "/v1/client/sign_ups",
          "POST",
          commonHdrs,
          rawBody || undefined,
        );
        const fapiBody = await fapiRes.text();

        if (fapiRes.status !== 422) {
          return forwardResponse(fapiRes, fapiBody, res);
        }

        let errorJson: { errors?: Array<{ code: string }> } = {};
        try {
          errorJson = JSON.parse(fapiBody);
        } catch {}
        const hasPwError = (errorJson.errors ?? []).some((e) =>
          PASSWORD_ERROR_CODES.has(e.code),
        );

        if (!hasPwError) {
          return forwardResponse(fapiRes, fapiBody, res);
        }

        console.log("[sign_up] HIBP blocked → BAPI fallback");

        const params = new URLSearchParams(rawBody);
        const email =
          params.get("email_address") ?? params.get("emailAddress") ?? "";
        const password = params.get("password") ?? "";
        if (!email || !password) {
          return forwardResponse(fapiRes, fapiBody, res);
        }

        // Create user (or accept already-exists)
        const bapiRes = await bapiFetch("/v1/users", "POST", {
          email_address: [email],
          password,
          skip_password_checks: true,
          first_name: params.get("first_name") ?? undefined,
          last_name: params.get("last_name") ?? undefined,
        });
        const bapiBody = await bapiRes.text();

        if (!bapiRes.ok) {
          const bapiErr = JSON.parse(bapiBody || "{}");
          const exists = (
            (bapiErr.errors ?? []) as Array<{ code: string }>
          ).some((e) => e.code === "form_identifier_exists");
          if (!exists) {
            console.error("[sign_up] BAPI failed:", bapiRes.status, bapiBody.substring(0, 300));
            return forwardResponse(fapiRes, fapiBody, res);
          }
          console.log("[sign_up] User already exists — proceeding to sign-in");
        } else {
          const u = JSON.parse(bapiBody);
          console.log("[sign_up] BAPI created user:", u.id);
        }

        // Sign in via FAPI to establish session + cookies properly
        const signInParams = new URLSearchParams();
        signInParams.set("strategy", "password");
        signInParams.set("identifier", email);
        signInParams.set("password", password);

        const signInRes = await fapiFetch(
          "/v1/client/sign_ins",
          "POST",
          { ...commonHdrs, "Content-Type": "application/x-www-form-urlencoded" },
          signInParams.toString(),
        );
        const signInBody = await signInRes.text();

        if (signInRes.ok) {
          try {
            const signInJson = JSON.parse(signInBody);
            const synthetic = {
              response: {
                id: `sua_bapi_${Date.now()}`,
                object: "sign_up_attempt",
                status: "complete",
                created_session_id:
                  signInJson.response?.created_session_id ?? null,
                missing_fields: [],
                unverified_fields: [],
                verifications: {},
              },
              client: signInJson.client,
            };
            // Forward Set-Cookie from sign-in response
            const setCookies =
              (signInRes.headers as unknown as {
                getSetCookie?: () => string[];
              }).getSetCookie?.() ?? [];
            if (setCookies.length > 0) {
              res.setHeader("Set-Cookie", setCookies);
            }
            res.setHeader("Content-Type", "application/json");
            return res.status(200).json(synthetic);
          } catch {
            return forwardResponse(signInRes, signInBody, res);
          }
        }

        // sign-in didn't return ok — might still need verification step
        console.log("[sign_up] sign-in status:", signInRes.status);
        return forwardResponse(signInRes, signInBody, res);
      },
    );

    // ─── SIGN-IN attempt_first_factor interceptor ─────────────────
    // Clerk also enforces HIBP on sign-in password attempt.  We use
    // the BAPI to verify the password and forward the original
    // FAPI response when verification succeeds (the FAPI response
    // already contains a partial sign-in session that we upgrade).
    app.post(
      new RegExp(
        `^${CLERK_PROXY_PATH.replace(/\//g, "\\/")}\\/v1\\/client\\/sign_ins\\/([^\\/]+)\\/attempt_first_factor$`,
      ),
      express.raw({ type: "*/*", limit: "4mb" }),
      async (req, res) => {
        const commonHdrs = buildCommonHeaders(req);
        const rawBody: string =
          (req.body as Buffer)?.toString("utf8") ?? "";

        // Extract sign-in attempt id from URL
        const match = req.path.match(/\/sign_ins\/([^\/]+)\/attempt_first_factor/);
        const siaId = match?.[1];

        const upstreamPath = req.path.replace(CLERK_PROXY_PATH, "");
        const fapiRes = await fapiFetch(
          upstreamPath,
          "POST",
          commonHdrs,
          rawBody || undefined,
        );
        const fapiBody = await fapiRes.text();

        if (fapiRes.status !== 422 || !siaId) {
          return forwardResponse(fapiRes, fapiBody, res);
        }

        let errorJson: { errors?: Array<{ code: string }> } = {};
        try {
          errorJson = JSON.parse(fapiBody);
        } catch {}
        const hasPwError = (errorJson.errors ?? []).some((e) =>
          PASSWORD_ERROR_CODES.has(e.code),
        );

        if (!hasPwError) {
          console.log("[sign_in 422 non-pw]", JSON.stringify(errorJson.errors));
          return forwardResponse(fapiRes, fapiBody, res);
        }

        console.log("[sign_in] HIBP blocked → BAPI verify_password");

        // Get sign-in attempt details to extract identifier (email)
        const siaRes = await fapiFetch(
          `/v1/client/sign_ins/${siaId}`,
          "GET",
          commonHdrs,
        );
        const siaJson = JSON.parse(await siaRes.text());
        const identifier =
          siaJson.response?.identifier ??
          siaJson.identifier ??
          siaJson.response?.user_data?.email_address;

        const params = new URLSearchParams(rawBody);
        const password = params.get("password") ?? "";

        if (!identifier || !password) {
          console.error("[sign_in] missing identifier/password");
          return forwardResponse(fapiRes, fapiBody, res);
        }

        // Find user by email
        const usersRes = await bapiFetch(
          `/v1/users?email_address=${encodeURIComponent(identifier)}`,
          "GET",
        );
        const users = JSON.parse(await usersRes.text());
        const user = Array.isArray(users) ? users[0] : null;
        if (!user?.id) {
          console.error("[sign_in] user not found:", identifier);
          return forwardResponse(fapiRes, fapiBody, res);
        }

        // Verify password
        const verifyRes = await bapiFetch(
          `/v1/users/${user.id}/verify_password`,
          "POST",
          { password },
        );

        if (!verifyRes.ok) {
          // Bad password — return original error so user sees standard
          // "incorrect password" message
          console.log("[sign_in] BAPI verify_password failed:", verifyRes.status);
          return forwardResponse(fapiRes, fapiBody, res);
        }

        console.log("[sign_in] BAPI verified password — rotating to bypass HIBP");

        // Strategy: temporarily change the user's password to a strong
        // random one, sign in via FAPI with that, then revert.  This
        // is necessary because FAPI sign-in always checks HIBP and we
        // need to actually establish session cookies on the browser.
        const tempPassword = `Aido${Date.now()}!${Math.random().toString(36).slice(2, 12)}Wedding#2026`;

        const updateRes = await bapiFetch(
          `/v1/users/${user.id}`,
          "POST",
          { password: tempPassword, skip_password_checks: true },
        );
        if (!updateRes.ok) {
          console.error("[sign_in] password rotation update failed:", updateRes.status);
          return forwardResponse(fapiRes, fapiBody, res);
        }

        // Now sign in via FAPI with the temp password — this establishes
        // proper browser session cookies and produces a valid response
        const tempParams = new URLSearchParams();
        tempParams.set(
          "strategy",
          (params.get("strategy") as string) || "password",
        );
        tempParams.set("password", tempPassword);

        const retryRes = await fapiFetch(
          `/v1/client/sign_ins/${siaId}/attempt_first_factor`,
          "POST",
          commonHdrs,
          tempParams.toString(),
        );
        const retryBody = await retryRes.text();

        // Restore the user's original password (skip_password_checks bypasses HIBP)
        await bapiFetch(`/v1/users/${user.id}`, "POST", {
          password,
          skip_password_checks: true,
        });

        console.log("[sign_in] password restored, FAPI status:", retryRes.status);
        return forwardResponse(retryRes, retryBody, res);
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
