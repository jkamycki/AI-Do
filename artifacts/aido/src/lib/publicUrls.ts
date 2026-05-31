const DEFAULT_PUBLIC_ORIGIN = "https://aidowedding.net";

export function publicAppOrigin() {
  const configured = (import.meta.env.VITE_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;

  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/+$/, "");
    const host = window.location.hostname.toLowerCase();
    if (host === "aidowedding.net" || host === "www.aidowedding.net") return origin;
  }

  return DEFAULT_PUBLIC_ORIGIN;
}

export function publishedWebsiteUrl(slug: string, section = "home") {
  const cleanSlug = slug.trim().replace(/^\/+|\/+$/g, "");
  const cleanSection = section?.trim().replace(/^\/+|\/+$/g, "");
  if (!cleanSection || cleanSection === "home") return `${publicAppOrigin()}/w/${cleanSlug}`;
  return `${publicAppOrigin()}/w/${cleanSlug}${cleanSection ? `/${cleanSection}` : ""}`;
}

export function publishedWebsiteQrUrl(slug: string) {
  return publishedWebsiteUrl(slug);
}
