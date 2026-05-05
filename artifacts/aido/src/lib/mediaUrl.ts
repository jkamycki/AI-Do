const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!API_BASE) return url;
  if (/^(blob:|data:|https?:\/\/)/i.test(url)) return url;
  if (url.startsWith("/api/")) return `${API_BASE}${url}`;
  if (url.startsWith("/storage/")) return `${API_BASE}/api${url}`;
  if (url.startsWith("/objects/")) return `${API_BASE}/api/storage${url}`;
  return url;
}
