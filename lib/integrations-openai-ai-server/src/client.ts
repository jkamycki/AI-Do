import OpenAI from "openai";

const replitBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "";
const replitApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "";
const directBaseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const directApiKey = process.env.OPENAI_API_KEY ?? "";

// If base URL points to the Replit local proxy, use it as-is (works inside Replit).
// Otherwise fall back: if the Replit integration key is set, pair it with the
// configured base URL (or api.openai.com). Last resort: OPENAI_API_KEY direct.
const isReplitProxy = replitBaseUrl.startsWith("http://localhost");

let baseURL: string;
let apiKey: string;

if (isReplitProxy) {
  baseURL = replitBaseUrl;
  apiKey = replitApiKey;
} else if (replitApiKey) {
  // Non-localhost base URL (or none) + Replit key → use explicit url or openai default
  baseURL = (replitBaseUrl || directBaseUrl).replace(/\/$/, "");
  apiKey = replitApiKey;
} else if (directApiKey) {
  baseURL = directBaseUrl.replace(/\/$/, "");
  apiKey = directApiKey;
} else {
  throw new Error(
    "No AI provider configured. Set AI_INTEGRATIONS_OPENAI_API_KEY or OPENAI_API_KEY.",
  );
}

export const openai = new OpenAI({ apiKey, baseURL });
