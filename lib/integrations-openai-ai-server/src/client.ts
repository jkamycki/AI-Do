import OpenAI from "openai";

const rawBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "";

// If the base URL is missing or still points to the Replit local proxy (localhost),
// fall back to the standard OpenAI endpoint automatically.
// This means only AI_INTEGRATIONS_OPENAI_API_KEY is required in production.
const baseURL =
  rawBaseUrl && !rawBaseUrl.includes("localhost")
    ? rawBaseUrl.replace(/\/$/, "")
    : "https://api.openai.com/v1";

if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_API_KEY must be set.",
  );
}

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL,
});
