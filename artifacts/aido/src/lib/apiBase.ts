export function isLocalAppOrigin() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export function getApiBaseUrl() {
  if (isLocalAppOrigin()) return "";
  return String(import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
}

export const API_BASE_URL = getApiBaseUrl();
