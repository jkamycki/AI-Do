const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export function getResolvedMediaUrl(url: string | null | undefined): string | null {
  return resolveMediaUrl(url);
}

export function isMediaAuthRequired(url: string | null | undefined): boolean {
  if (!url) return false;
  if (/^(blob:|data:)/i.test(url)) return false;
  if (url.startsWith("/objects/")) return true;
  if (url.startsWith("/storage/")) return true;
  if (url.startsWith("/api/storage/")) return true;
  try {
    return new URL(url).pathname.startsWith("/api/storage/");
  } catch {
    return false;
  }
}

export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(blob:|data:|https?:\/\/)/i.test(url)) return url;
  // Stored object paths (e.g. "/objects/uploads/abc") are NOT a real route on
  // the API; the browser fetch endpoint lives at "/api/storage/objects/...".
  // Translate the path BEFORE the API_BASE early-return, otherwise relative
  // (same-origin) deployments hit /objects/* and 404.
  let path = url;
  if (path.startsWith("/storage/")) path = `/api${path}`;
  else if (path.startsWith("/objects/")) path = `/api/storage${path}`;
  if (!API_BASE) return path;
  if (path.startsWith("/api/")) return `${API_BASE}${path}`;
  return path;
}
