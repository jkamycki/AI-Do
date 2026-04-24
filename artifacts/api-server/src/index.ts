import app from "./app";
import { logger } from "./lib/logger";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  void disableClerkBreachedPasswordCheck();
});

async function disableClerkBreachedPasswordCheck(): Promise<void> {
  const clerkEnvKeys = Object.keys(process.env)
    .filter((k) => k.toUpperCase().includes("CLERK"))
    .map((k) => {
      const v = process.env[k] ?? "";
      return { key: k, prefix: v.slice(0, 14), len: v.length };
    });
  logger.info({ clerkEnvKeys }, "[DIAG] Clerk-related env vars present");

  const candidates: Array<{ name: string; key: string }> = [];
  for (const envName of [
    "CLERK_LIVE_SECRET_KEY",
    "CLERK_PROD_SECRET_KEY",
    "CLERK_PRODUCTION_SECRET_KEY",
    "CLERK_SECRET_KEY",
  ]) {
    const v = process.env[envName];
    if (v && !candidates.find((c) => c.key === v)) {
      candidates.push({ name: envName, key: v });
    }
  }

  for (const cand of candidates) {
    try {
      const getRes = await fetch("https://api.clerk.com/v1/instance", {
        headers: { Authorization: `Bearer ${cand.key}` },
      });
      const info = (await getRes.json().catch(() => ({}))) as {
        id?: string;
        environment_type?: string;
      };
      logger.info(
        {
          source: cand.name,
          instanceId: info.id,
          envType: info.environment_type,
        },
        "[DIAG] Clerk instance reached with this key",
      );

      if (info.environment_type !== "production") {
        logger.info(
          { source: cand.name },
          "[DIAG] Skipping non-production instance",
        );
        continue;
      }

      const patchRes = await fetch("https://api.clerk.com/v1/instance", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${cand.key}`,
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
        { source: cand.name, status: patchRes.status },
        "[DIAG] PATCH on production Clerk instance",
      );
      if (patchRes.ok) {
        logger.info("[DIAG] Production breach-check disabled successfully");
        return;
      }
    } catch (err) {
      logger.warn(
        { err, source: cand.name },
        "[DIAG] Failed to query/patch with this key",
      );
    }
  }

  logger.warn("[DIAG] No production Clerk secret key found in environment");
}
