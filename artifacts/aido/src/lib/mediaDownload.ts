import { authFetch } from "./authFetch";
import { isMediaAuthRequired, resolveMediaUrl } from "./mediaUrl";

function sanitizeFilePart(value: string | null | undefined, fallback: string) {
  const cleaned = (value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}

function extensionFromName(value: string | null | undefined) {
  if (!value) return "";
  const match = value.split(/[?#]/)[0]?.match(/\.([a-z0-9]{2,5})$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

function extensionFromContentType(value: string | null | undefined) {
  if (!value) return "";
  if (value.includes("png")) return "png";
  if (value.includes("webp")) return "webp";
  if (value.includes("heic")) return "heic";
  if (value.includes("heif")) return "heif";
  if (value.includes("gif")) return "gif";
  if (value.includes("jpeg") || value.includes("jpg")) return "jpg";
  return "";
}

function triggerDownload(href: string, filename: string, openFallback = false) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  if (openFallback) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function guestPhotoDownloadName({
  guestName,
  id,
  originalName,
  imageUrl,
  contentType,
}: {
  guestName?: string | null;
  id?: number | string | null;
  originalName?: string | null;
  imageUrl?: string | null;
  contentType?: string | null;
}) {
  const base = sanitizeFilePart(guestName, "guest-photo");
  const identifier = id == null ? "" : `-${id}`;
  const extension =
    extensionFromName(originalName)
    || extensionFromName(imageUrl)
    || extensionFromContentType(contentType)
    || "jpg";
  return `aido-${base}${identifier}.${extension}`;
}

export async function downloadMediaFile(
  sourceUrl: string | null | undefined,
  filename: string,
  options: { authenticated?: boolean } = {},
) {
  const resolvedUrl = resolveMediaUrl(sourceUrl);
  if (!resolvedUrl) throw new Error("Photo is missing a download URL.");

  if (/^(blob:|data:)/i.test(resolvedUrl)) {
    triggerDownload(resolvedUrl, filename);
    return;
  }

  const needsAuth = options.authenticated === true
    || isMediaAuthRequired(sourceUrl)
    || isMediaAuthRequired(resolvedUrl);

  try {
    const response = needsAuth
      ? await authFetch(resolvedUrl)
      : await fetch(resolvedUrl, { credentials: "include" });

    if (!response.ok) throw new Error(`Download failed with status ${response.status}.`);

    const contentType = response.headers.get("content-type");
    const blob = await response.blob();
    const finalFilename = /\.[a-z0-9]{2,5}$/i.test(filename)
      ? filename
      : guestPhotoDownloadName({ guestName: filename, contentType });
    const objectUrl = URL.createObjectURL(blob);
    try {
      triggerDownload(objectUrl, finalFilename);
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  } catch (error) {
    triggerDownload(resolvedUrl, filename, true);
    if (error instanceof Error) return;
    throw error;
  }
}
