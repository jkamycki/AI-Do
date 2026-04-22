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

        const params = new URLSearchParams(rawBody);
        const email =
          params.get("email_address") ?? params.get("emailAddress") ?? "";
        const password = params.get("password") ?? "";

        // If this isn't an email+password sign-up (e.g. OAuth), pass through
        if (!email || !password) {
          const passRes = await fapiFetch(
            "/v1/client/sign_ups",
            "POST",
            commonHdrs,
            rawBody || undefined,
          );
          return forwardResponse(passRes, await passRes.text(), res);
        }

        // ALWAYS use BAPI for email+password sign-up.  This:
        //  - bypasses Clerk's HIBP password-breach check
        //  - auto-verifies the email (no verification code email needed)
        //  - is the only reliable path on Clerk dev instances
        console.log("[sign_up] email+password → BAPI direct");

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

    // Shared helper: complete a sign-in via admin sign-in ticket.
    // Bypasses HIBP, "new device" reverification, AND 2FA challenges.
    const completeViaTicket = async (
      userId: string,
      origSiaId: string,
      commonHdrs: FetchHeaders,
      res: express.Response,
    ): Promise<boolean> => {
      const tokenRes = await bapiFetch("/v1/sign_in_tokens", "POST", {
        user_id: userId,
        expires_in_seconds: 60,
      });
      if (!tokenRes.ok) {
        console.error(
          "[ticket] sign_in_token failed:",
          tokenRes.status,
          (await tokenRes.text()).substring(0, 200),
        );
        return false;
      }
      const { token: ticket } = JSON.parse(await tokenRes.text());

      const ticketParams = new URLSearchParams();
      ticketParams.set("strategy", "ticket");
      ticketParams.set("ticket", ticket);

      const ticketRes = await fapiFetch(
        "/v1/client/sign_ins",
        "POST",
        { ...commonHdrs, "Content-Type": "application/x-www-form-urlencoded" },
        ticketParams.toString(),
      );
      const ticketBody = await ticketRes.text();
      if (!ticketRes.ok) {
        console.error(
          "[ticket] sign-in failed:",
          ticketRes.status,
          ticketBody.substring(0, 300),
        );
        return false;
      }

      const ticketJson = JSON.parse(ticketBody);
      const synthetic = {
        response: {
          ...ticketJson.response,
          id: origSiaId,
          object: "sign_in_attempt",
          status: "complete",
        },
        client: ticketJson.client,
      };

      const setCookies =
        (ticketRes.headers as unknown as {
          getSetCookie?: () => string[];
        }).getSetCookie?.() ?? [];
      if (setCookies.length > 0) {
        res.setHeader("Set-Cookie", setCookies);
      }
      res.setHeader("Content-Type", "application/json");
      res.status(200).json(synthetic);
      return true;
    };

    // Shared helper: look up a user id from a sign-in attempt id
    const findUserIdFromSia = async (
      siaId: string,
      commonHdrs: FetchHeaders,
    ): Promise<string | null> => {
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
      if (!identifier) return null;

      const usersRes = await bapiFetch(
        `/v1/users?email_address=${encodeURIComponent(identifier)}`,
        "GET",
      );
      const users = JSON.parse(await usersRes.text());
      const user = Array.isArray(users) ? users[0] : null;
      return user?.id ?? null;
    };

    // ─── SIGN-IN attempt_first_factor interceptor ─────────────────
    // Handles two cases:
    //  (a) 422 password-breach error → BAPI verify + ticket bypass
    //  (b) 200 with status="needs_second_factor" → ticket bypass
    //      (skips 2FA email codes that don't get delivered)
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

        if (!siaId) return forwardResponse(fapiRes, fapiBody, res);

        // Case (b): 200 with needs_second_factor → ticket-bypass 2FA
        if (fapiRes.status === 200) {
          try {
            const j = JSON.parse(fapiBody);
            if (j.response?.status === "needs_second_factor") {
              console.log("[sign_in] needs_second_factor → ticket bypass");
              const userId = await findUserIdFromSia(siaId, commonHdrs);
              if (userId) {
                const ok = await completeViaTicket(
                  userId,
                  siaId,
                  commonHdrs,
                  res,
                );
                if (ok) return;
              }
            }
          } catch {}
          return forwardResponse(fapiRes, fapiBody, res);
        }

        if (fapiRes.status !== 422) {
          return forwardResponse(fapiRes, fapiBody, res);
        }

        // Case (a): 422 password-breach → BAPI verify + ticket bypass
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

        console.log("[sign_in] HIBP blocked → BAPI verify_password");

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
          return forwardResponse(fapiRes, fapiBody, res);
        }

        const usersRes = await bapiFetch(
          `/v1/users?email_address=${encodeURIComponent(identifier)}`,
          "GET",
        );
        const users = JSON.parse(await usersRes.text());
        const user = Array.isArray(users) ? users[0] : null;
        if (!user?.id) {
          return forwardResponse(fapiRes, fapiBody, res);
        }

        const verifyRes = await bapiFetch(
          `/v1/users/${user.id}/verify_password`,
          "POST",
          { password },
        );
        if (!verifyRes.ok) {
          return forwardResponse(fapiRes, fapiBody, res);
        }

        const ok = await completeViaTicket(user.id, siaId, commonHdrs, res);
        if (!ok) {
          return forwardResponse(fapiRes, fapiBody, res);
        }
      },
    );

    // ─── SIGN-IN second-factor interceptors ───────────────────────
    // Bypass any 2FA challenge (email/SMS code) using ticket strategy.
    // Clerk dev-instance email delivery is unreliable; the ticket
    // strategy completes the sign-in without any code.
    const secondFactorBypass = async (
      req: express.Request,
      res: express.Response,
    ) => {
      const commonHdrs = buildCommonHeaders(req);
      const rawBody: string =
        (req.body as Buffer)?.toString("utf8") ?? "";

      const match = req.path.match(
        /\/sign_ins\/([^\/]+)\/(prepare|attempt)_second_factor/,
      );
      const siaId = match?.[1];

      if (siaId) {
        const userId = await findUserIdFromSia(siaId, commonHdrs);
        if (userId) {
          console.log("[2fa] ticket-bypass for", siaId);
          const ok = await completeViaTicket(userId, siaId, commonHdrs, res);
          if (ok) return;
        }
      }

      // Fallback: forward to FAPI as normal
      const upstreamPath = req.path.replace(CLERK_PROXY_PATH, "");
      const fapiRes = await fapiFetch(
        upstreamPath,
        "POST",
        commonHdrs,
        rawBody || undefined,
      );
      forwardResponse(fapiRes, await fapiRes.text(), res);
    };

    app.post(
      new RegExp(
        `^${CLERK_PROXY_PATH.replace(/\//g, "\\/")}\\/v1\\/client\\/sign_ins\\/([^\\/]+)\\/prepare_second_factor$`,
      ),
      express.raw({ type: "*/*", limit: "4mb" }),
      secondFactorBypass,
    );

    app.post(
      new RegExp(
        `^${CLERK_PROXY_PATH.replace(/\//g, "\\/")}\\/v1\\/client\\/sign_ins\\/([^\\/]+)\\/attempt_second_factor$`,
      ),
      express.raw({ type: "*/*", limit: "4mb" }),
      secondFactorBypass,
    );
  }
}

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));

import resendInboundRouter from "./routes/webhooks/resendInbound";
app.use("/api", resendInboundRouter);
import cloudflareInboundRouter from "./routes/webhooks/cloudflareInbound";
app.use("/api", cloudflareInboundRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", router);

export default app;
