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

    // ─── SIGN-UP: forward directly to FAPI ───────────────────────
    // Sign-up requests are forwarded to Clerk's normal FAPI endpoint so
    // that Clerk's standard email verification flow is preserved.  Using
    // the Backend API to create users with skip_password_checks/auto-
    // verified emails would let an attacker register any email address
    // without proving ownership, breaking the application's identity model.
    app.post(
      `${CLERK_PROXY_PATH}/v1/client/sign_ups`,
      express.raw({ type: "*/*", limit: "4mb" }),
      async (req, res) => {
        const commonHdrs = buildCommonHeaders(req);
        const rawBody: string =
          (req.body as Buffer)?.toString("utf8") ?? "";

        const passRes = await fapiFetch(
          "/v1/client/sign_ups",
          "POST",
          commonHdrs,
          rawBody || undefined,
        );
        return forwardResponse(passRes, await passRes.text(), res);
      },
    );

    // Shared helper: complete a sign-in via admin sign-in ticket.
    // Used only as a fallback when Clerk's HIBP check blocks a valid password.
    // Must NOT be called without first verifying the user's password via BAPI.
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

    // ─── SIGN-IN attempt_first_factor interceptor ─────────────────
    // Handles HIBP password-breach errors only:
    //  (a) 422 password-breach error → BAPI verify_password + ticket bypass
    // When Clerk returns 200 (including needs_second_factor), the response is
    // forwarded as-is so that Clerk's normal 2FA flow proceeds.
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

        // Any non-422 response (including 200/needs_second_factor) is forwarded
        // unchanged so Clerk's normal second-factor flow is preserved.
        if (!siaId || fapiRes.status !== 422) {
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

        // Do not use the ticket bypass if the user has MFA enabled.
        // The ticket strategy is an admin token that bypasses all second-factor
        // requirements; using it for MFA users would silently skip their 2FA.
        if (user.two_factor_enabled) {
          console.log("[sign_in] user has 2FA enabled — not using ticket bypass for HIBP case");
          return forwardResponse(fapiRes, fapiBody, res);
        }

        const ok = await completeViaTicket(user.id, siaId, commonHdrs, res);
        if (!ok) {
          return forwardResponse(fapiRes, fapiBody, res);
        }
      },
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
