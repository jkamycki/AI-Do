/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies Clerk Frontend API requests through your domain, enabling Clerk
 * authentication on custom domains and .replit.app deployments without
 * requiring CNAME DNS configuration.
 *
 * AUTH CONFIGURATION: To manage users, enable/disable login providers
 * (Google, GitHub, etc.), change app branding, or configure OAuth credentials,
 * use the Auth pane in the workspace toolbar. There is no external Clerk
 * dashboard — all auth configuration is done through the Auth pane.
 *
 * IMPORTANT:
 * - Only active in production (Clerk proxying doesn't work for dev instances)
 * - Must be mounted BEFORE express.json() middleware
 *
 * Usage in app.ts:
 *   import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
 *   app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
 */

import { createProxyMiddleware } from "http-proxy-middleware";
import type { RequestHandler } from "express";
import type { IncomingMessage, ClientRequest } from "http";
import { logger } from "../lib/logger";

const CLERK_FAPI = "https://frontend-api.clerk.dev";
export const CLERK_PROXY_PATH = "/api/__clerk";

export function clerkProxyMiddleware(): RequestHandler {
  // Only run proxy in production — Clerk proxying doesn't work for dev instances
  if (process.env.NODE_ENV !== "production") {
    return (_req, _res, next) => next();
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return (_req, _res, next) => next();
  }

  const pubKey = process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || "";
  logger.info({ pubKeyPrefix: pubKey.substring(0, 20) }, "[Clerk Proxy] Initialising");

  return createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    selfHandleResponse: false,
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
    on: {
      proxyReq: (proxyReq: ClientRequest, req: IncomingMessage & { headers: Record<string, string | string[] | undefined> }) => {
        const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
        const host = (req.headers["host"] as string) || "";
        const proxyUrl = `${protocol}://${host}${CLERK_PROXY_PATH}`;

        proxyReq.setHeader("Clerk-Proxy-Url", proxyUrl);
        proxyReq.setHeader("Clerk-Secret-Key", secretKey);

        const xff = req.headers["x-forwarded-for"];
        const clientIp =
          (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim() ||
          (req.socket as any)?.remoteAddress ||
          "";
        if (clientIp) {
          proxyReq.setHeader("X-Forwarded-For", clientIp);
        }

        const url = (req as any).url || "";
        if (url.includes("sign_up")) {
          logger.debug({ proxyUrl }, "[Clerk Proxy] sign_up request");
        }
      },
      proxyRes: (proxyRes: IncomingMessage, req: IncomingMessage) => {
        const url = (req as any).url || "";
        if (proxyRes.statusCode === 422 && url.includes("sign_up")) {
          const chunks: Buffer[] = [];
          proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
          proxyRes.on("end", () => {
            try {
              const body = Buffer.concat(chunks).toString("utf8");
              logger.error({ body: body.substring(0, 1200) }, "[Clerk 422 sign_up BODY]");
            } catch {}
          });
        }
      },
    },
  }) as RequestHandler;
}
