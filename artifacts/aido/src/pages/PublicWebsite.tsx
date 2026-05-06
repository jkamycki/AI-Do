import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { apiFetch } from "@/lib/authFetch";
import { Loader2, Lock } from "lucide-react";
import { WebsiteRenderer, type WebsiteRendererPayload, sectionFromUrlSegment } from "@/components/website/WebsiteRenderer";

interface PublicSitePayload extends WebsiteRendererPayload {
  slug: string;
}

function fontStack(font: string): string {
  return `'${font}', 'Playfair Display', Georgia, serif`;
}

function setMeta(name: string, content: string, isProperty = false) {
  const attr = isProperty ? "property" : "name";
  let el = document.head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function PasswordGate({ accent, font, onSubmit, error }: { accent: string; font: string; onSubmit: (pw: string) => void; error: string | null }) {
  const [pw, setPw] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FAF8F4" }}>
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6" style={{ background: `${accent}15` }}>
          <Lock className="h-7 w-7" style={{ color: accent }} />
        </div>
        <h1 className="text-3xl mb-3" style={{ fontFamily: fontStack(font), color: "#222" }}>
          Private Wedding
        </h1>
        <p className="text-sm text-gray-600 mb-8">
          This wedding site is password protected. Please enter the password the couple shared with you.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pw.trim()) onSubmit(pw.trim());
          }}
          className="flex flex-col gap-3"
        >
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 text-base"
            style={{ outlineColor: accent }}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full px-4 py-3 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
            style={{ background: accent }}
          >
            View Site
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PublicWebsite() {
  const [matchedSlug, slugParams] = useRoute("/w/:slug");
  const [matchedSection, sectionParams] = useRoute("/w/:slug/:section");
  const slug = (matchedSection ? sectionParams?.slug : slugParams?.slug) ?? "";
  const sectionSeg = matchedSection ? sectionParams?.section : undefined;
  const currentSection = sectionFromUrlSegment(sectionSeg);
  // Reference matchedSlug to suppress unused-var warning while keeping it
  // available for future use.
  void matchedSlug;

  const [password, setPassword] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(`aido_w_pw_${slug}`);
    } catch {
      return null;
    }
  });
  const [data, setData] = useState<PublicSitePayload | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    const url = password
      ? `/api/website/public/${encodeURIComponent(slug)}?password=${encodeURIComponent(password)}`
      : `/api/website/public/${encodeURIComponent(slug)}`;
    apiFetch(url)
      .then(async (res) => {
        if (res.status === 401) {
          const body = await res.json().catch(() => ({}));
          if (body?.passwordRequired) {
            setNeedsPassword(true);
            setData(null);
            if (password) setPwError("Incorrect password. Please try again.");
            return;
          }
        }
        if (res.status === 404) {
          setError("This wedding website doesn't exist or hasn't been published yet.");
          return;
        }
        if (!res.ok) {
          setError("Failed to load this site. Please try again later.");
          return;
        }
        const body = (await res.json()) as PublicSitePayload;
        setData(body);
        setNeedsPassword(false);
        setPwError(null);
      })
      .catch(() => setError("Failed to load this site. Please try again later."))
      .finally(() => setLoading(false));
  }, [slug, password]);

  useEffect(() => {
    if (!data?.font) return;
    const id = "aido-public-website-font";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    const fontName = encodeURIComponent(data.font).replace(/%20/g, "+");
    link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;600;700&display=swap`;
  }, [data?.font]);

  useEffect(() => {
    if (data) {
      const couple = `${data.couple.partner1Name} & ${data.couple.partner2Name}`;
      const description = (data.customText.welcome || data.customText.story || `Join us as we celebrate our wedding.`).slice(0, 160);
      const heroAbsolute = data.heroImage
        ? (data.heroImage.startsWith("/objects/") ? `${window.location.origin}/api/storage${data.heroImage}` : data.heroImage)
        : null;
      document.title = `${couple} — Wedding`;
      setMeta("description", description);
      setMeta("og:title", `${couple} — Wedding`, true);
      setMeta("og:description", description, true);
      setMeta("og:type", "website", true);
      setMeta("og:url", window.location.href, true);
      if (heroAbsolute) setMeta("og:image", heroAbsolute, true);
      setMeta("twitter:card", heroAbsolute ? "summary_large_image" : "summary");
      setMeta("twitter:title", `${couple} — Wedding`);
      setMeta("twitter:description", description);
      if (heroAbsolute) setMeta("twitter:image", heroAbsolute);
    } else {
      document.title = "Wedding Website";
    }
  }, [data]);

  if (loading && !data && !needsPassword && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAF8F4" }}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (needsPassword) {
    return (
      <PasswordGate
        accent="#D4A017"
        font="Playfair Display"
        error={pwError}
        onSubmit={(pw) => {
          try {
            sessionStorage.setItem(`aido_w_pw_${slug}`, pw);
          } catch {
            // ignore sessionStorage failures
          }
          setPassword(pw);
        }}
      />
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center" style={{ background: "#FAF8F4" }}>
        <div>
          <h1 className="text-2xl mb-2 text-gray-800" style={{ fontFamily: fontStack("Playfair Display") }}>Page not found</h1>
          <p className="text-sm text-gray-600">{error ?? "This wedding website is not available."}</p>
        </div>
      </div>
    );
  }

  // Scroll to top on section navigation so each "page" feels distinct.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentSection]);

  return <WebsiteRenderer data={data} currentSection={currentSection} slug={slug} password={password} />;
}
