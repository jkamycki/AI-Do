type SeoOptions = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

const DEFAULT_ORIGIN = "https://aidowedding.net";
const DEFAULT_IMAGE = `${DEFAULT_ORIGIN}/opengraph.jpg`;

function publicOrigin() {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined" && /(^|\.)aidowedding\.net$/i.test(window.location.hostname)) {
    return window.location.origin.replace(/\/+$/, "");
  }
  return DEFAULT_ORIGIN;
}

function upsertMeta(selector: string, create: () => HTMLMetaElement, content: string) {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function setSeo({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
  type = "website",
  noindex = false,
  jsonLd,
}: SeoOptions) {
  if (typeof document === "undefined") return;

  const canonical = `${publicOrigin()}${path ?? window.location.pathname}`;
  document.title = title;
  upsertMeta('meta[name="description"]', () => {
    const el = document.createElement("meta");
    el.name = "description";
    return el;
  }, description);
  upsertMeta('meta[name="robots"]', () => {
    const el = document.createElement("meta");
    el.name = "robots";
    return el;
  }, noindex ? "noindex,nofollow" : "index,follow");
  upsertMeta('meta[property="og:title"]', () => {
    const el = document.createElement("meta");
    el.setAttribute("property", "og:title");
    return el;
  }, title);
  upsertMeta('meta[property="og:description"]', () => {
    const el = document.createElement("meta");
    el.setAttribute("property", "og:description");
    return el;
  }, description);
  upsertMeta('meta[property="og:type"]', () => {
    const el = document.createElement("meta");
    el.setAttribute("property", "og:type");
    return el;
  }, type);
  upsertMeta('meta[property="og:url"]', () => {
    const el = document.createElement("meta");
    el.setAttribute("property", "og:url");
    return el;
  }, canonical);
  upsertMeta('meta[property="og:image"]', () => {
    const el = document.createElement("meta");
    el.setAttribute("property", "og:image");
    return el;
  }, image);
  upsertMeta('meta[name="twitter:title"]', () => {
    const el = document.createElement("meta");
    el.name = "twitter:title";
    return el;
  }, title);
  upsertMeta('meta[name="twitter:description"]', () => {
    const el = document.createElement("meta");
    el.name = "twitter:description";
    return el;
  }, description);
  upsertMeta('meta[name="twitter:image"]', () => {
    const el = document.createElement("meta");
    el.name = "twitter:image";
    return el;
  }, image);
  upsertLink("canonical", canonical);

  document.querySelectorAll('script[data-aido-seo="jsonld"]').forEach((el) => el.remove());
  const schemas = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  schemas.forEach((schema) => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.aidoSeo = "jsonld";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  });
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "A.I DO",
    url: DEFAULT_ORIGIN,
    logo: `${DEFAULT_ORIGIN}/logo.png`,
    sameAs: [],
  };
}

export function softwareSchema(name: string, description: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    applicationCategory: "Wedding planning software",
    operatingSystem: "Web",
    url: `${DEFAULT_ORIGIN}${path}`,
    description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}
