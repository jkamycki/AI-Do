const ALLOWED_ORIGINS = new Set([
  "https://aidowedding.net",
  "https://www.aidowedding.net",
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.PUBLIC_APP_URL ? [process.env.PUBLIC_APP_URL] : []),
]);

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/ai-do-aido[a-z0-9-]*\.vercel\.app$/,
  /^https:\/\/[a-z0-9-]+-kamyckijoseph[a-z0-9-]*\.vercel\.app$/,
];

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}
