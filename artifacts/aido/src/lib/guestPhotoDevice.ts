const GUEST_PHOTO_DEVICE_PREFIX = "aido_guest_photo_device";
const GLOBAL_GUEST_PHOTO_DEVICE_KEY = `${GUEST_PHOTO_DEVICE_PREFIX}_global`;

function randomDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function cookieName(slug?: string): string {
  return `${GUEST_PHOTO_DEVICE_PREFIX}_${encodeURIComponent(slug || "default")}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${60 * 60 * 24 * 365 * 2}; Path=/; SameSite=Lax${secure}`;
}

function validDeviceId(value: string | null | undefined): value is string {
  return Boolean(value && value.trim().length >= 16);
}

export function getGuestPhotoDeviceId(slug: string): string {
  const key = `${GUEST_PHOTO_DEVICE_PREFIX}_${slug || "default"}`;
  const slugCookieName = cookieName(slug);
  try {
    const candidates = [
      window.localStorage.getItem(key),
      readCookie(slugCookieName),
      window.localStorage.getItem(GLOBAL_GUEST_PHOTO_DEVICE_KEY),
      readCookie(GLOBAL_GUEST_PHOTO_DEVICE_KEY),
    ];
    const existing = candidates.find(validDeviceId);
    const next = existing ?? randomDeviceId();
    window.localStorage.setItem(key, next);
    window.localStorage.setItem(GLOBAL_GUEST_PHOTO_DEVICE_KEY, next);
    writeCookie(slugCookieName, next);
    writeCookie(GLOBAL_GUEST_PHOTO_DEVICE_KEY, next);
    return next;
  } catch {
    const existing = readCookie(slugCookieName) || readCookie(GLOBAL_GUEST_PHOTO_DEVICE_KEY);
    const next = validDeviceId(existing) ? existing : randomDeviceId();
    writeCookie(slugCookieName, next);
    writeCookie(GLOBAL_GUEST_PHOTO_DEVICE_KEY, next);
    return next;
  }
}

export function getGuestPhotoDeviceFingerprint(): string {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "unknown";
  const screenInfo = window.screen;
  const parts = [
    navigator.userAgent,
    navigator.platform,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(screenInfo?.width ?? ""),
    String(screenInfo?.height ?? ""),
    String(screenInfo?.availWidth ?? ""),
    String(screenInfo?.availHeight ?? ""),
    String(screenInfo?.colorDepth ?? ""),
    String(window.devicePixelRatio ?? ""),
    String(navigator.maxTouchPoints ?? ""),
    String((navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency ?? ""),
  ];
  return parts.join("|").slice(0, 800);
}
