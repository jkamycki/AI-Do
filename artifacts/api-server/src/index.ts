import { readdir, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import app from "./app";
import { logger } from "./lib/logger";
import { scheduleBackups } from "./lib/backup";
import { pool } from "@workspace/db";

// Run all SQL migration files from lib/db/migrations at startup.
// Each file uses ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS so
// they are safe to replay on every boot.
async function runMigrations(): Promise<void> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const migrationsDir = path.resolve(__dirname, "../../../lib/db/migrations");
  let files: string[] = [];
  try {
    files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    logger.warn({ migrationsDir }, "Migrations directory not found — skipping");
    return;
  }
  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      await client.query(sql);
      logger.info({ file }, "Migration applied");
    }
  } finally {
    client.release();
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

runMigrations()
  .then(() => {
    const server = app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");

      void disableClerkBreachedPasswordCheck();
      scheduleBackups();

      // SSE connections stay open for the duration of an AI response.
      // Render (and most proxies) close idle TCP connections after ~75s by
      // default, which cuts off long AI streams before the model finishes.
      // Setting these above the longest expected AI response (90s client
      // timeout in the frontend) ensures the socket stays alive.
      server.keepAliveTimeout = 120_000;
      server.headersTimeout = 125_000;
    });
  })
  .catch((err) => {
    logger.error({ err }, "Migration failed — refusing to start");
    process.exit(1);
  });

async function disableClerkBreachedPasswordCheck(): Promise<void> {
  const secretKey = process.env["CLERK_SECRET_KEY"];
  if (!secretKey) return;

  try {
    const res = await fetch("https://api.clerk.com/v1/instance", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password_settings: {
          disable_hibp: true,
          enforce_hibp_on_sign_in: false,
          show_zxcvbn: false,
          min_zxcvbn_strength: 0,
        },
      }),
    });
    logger.info(
      { status: res.status },
      "Clerk: requested breach-password check disable",
    );
  } catch (err) {
    logger.warn({ err }, "Clerk: failed to request breach-check disable");
  }
}
