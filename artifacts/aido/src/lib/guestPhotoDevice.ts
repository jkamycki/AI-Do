const GUEST_PHOTO_DEVICE_PREFIX = "aido_guest_photo_device";

function randomDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function getGuestPhotoDeviceId(slug: string): string {
  const key = `${GUEST_PHOTO_DEVICE_PREFIX}_${slug || "default"}`;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing && existing.length >= 16) return existing;
    const next = randomDeviceId();
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return randomDeviceId();
  }
}
