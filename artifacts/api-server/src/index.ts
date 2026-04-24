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
