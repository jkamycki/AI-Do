import OpenAI from "openai";

const replitBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "";
const replitApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "";
const directBaseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const directApiKey = process.env.OPENAI_API_KEY ?? "";

// If base URL points to the Replit local proxy, use it as-is (works inside Replit).
// Otherwise: use the explicit non-localhost base URL with the integration key,
// or fall back to OPENAI_API_KEY + OPENAI_BASE_URL for direct OpenAI access.
const isReplitProxy = replitBaseUrl.startsWith("http://localhost");

let baseURL: string;
let apiKey: string;

if (isReplitProxy) {
  baseURL = replitBaseUrl;
  apiKey = replitApiKey;
} else if (replitApiKey) {
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

/**
 * Returns the best chat model for the active provider.
 * Provider is detected from the resolved base URL.
 * Override at any time by setting the AI_MODEL env var.
 */
export function getModel(): string {
  if (process.env.AI_MODEL) return process.env.AI_MODEL;
  // llama-3.1-8b-instant: 20,000 TPM free tier (vs 6,000 for 70B) —
  // much less rate-limiting, lower latency, still strong at tool-calling.
  // Override with AI_MODEL=llama-3.3-70b-versatile for the larger model.
  if (baseURL.includes("groq.com")) return "llama-3.1-8b-instant";
  if (baseURL.includes("openrouter.ai")) return "meta-llama/llama-3.1-8b-instruct";
  if (baseURL.includes("anthropic")) return "claude-3-5-haiku-20241022";
  // OpenAI or Replit proxy
  return "gpt-4o-mini";
}

/**
 * Returns a vision-capable chat model for the active provider.
 * Most cheap text-only models (e.g. Llama 3.1/3.3 instant/versatile on Groq)
 * cannot accept image_url content, so endpoints that send images MUST use
 * this instead of getModel(). Override with AI_VISION_MODEL.
 */
export function getVisionModel(): string {
  if (process.env.AI_VISION_MODEL) return process.env.AI_VISION_MODEL;
  // Groq's free-tier multimodal Llama 4 Scout model — accepts image_url and is
  // OpenAI-compatible. The text-only AI_MODEL override does not apply here.
  if (baseURL.includes("groq.com")) return "meta-llama/llama-4-scout-17b-16e-instruct";
  if (baseURL.includes("openrouter.ai")) return "meta-llama/llama-3.2-11b-vision-instruct";
  if (baseURL.includes("anthropic")) return "claude-3-5-sonnet-20241022";
  // OpenAI or Replit proxy — gpt-4o-mini supports vision.
  return "gpt-4o-mini";
}
