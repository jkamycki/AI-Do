import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "req.headers['clerk-secret-key']",
    "req.headers['x-site-password']",
    "req.headers['x-api-key']",
    "req.body.password",
    "req.body.token",
    "req.body.inviteToken",
    "req.body.threadToken",
    "res.headers['set-cookie']",
    "body.password",
    "body.token",
    "body.inviteToken",
    "body.threadToken",
    "password",
    "secret",
    "token",
    "apiKey",
    "authorization",
    "cookie",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
