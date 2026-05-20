import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { apiFetch } from "@/lib/authFetch";
import { Loader2 } from "lucide-react";
import { RsvpFlow } from "@/components/website/RsvpFlow";
import type { WebsiteRendererPayload } from "@/components/website/WebsiteRenderer";

interface PublicSitePayload extends WebsiteRendererPayload {
  slug: string;
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

export default function SharedRsvp() {
  const [, params] = useRoute("/rsvp/shared/:slug");
  const slug = params?.slug ?? "";
  const [data, setData] = useState<PublicSitePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setData(null);
    apiFetch(`/api/website/public/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (res.status === 401) {
          setError("This RSVP page is password protected. Please use the wedding website link shared by the couple.");
          return;
        }
        if (res.status === 404) {
          setError("This RSVP page doesn't exist or hasn't been published yet.");
          return;
        }
        if (!res.ok) {
          setError("Failed to load this RSVP page. Please try again later.");
          return;
        }
        setData((await res.json()) as PublicSitePayload);
      })
      .catch(() => setError("Failed to load this RSVP page. Please try again later."))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!data) {
      document.title = "RSVP";
      return;
    }
    const couple = `${data.couple.partner2Name} & ${data.couple.partner1Name}`;
    const description = "Find your name on the guest list and RSVP.";
    document.title = `${couple} - RSVP`;
    setMeta("description", description);
    setMeta("og:title", `${couple} - RSVP`, true);
    setMeta("og:description", description, true);
    setMeta("og:type", "website", true);
    setMeta("og:url", window.location.href, true);
    setMeta("twitter:card", "summary");
    setMeta("twitter:title", `${couple} - RSVP`);
    setMeta("twitter:description", description);
  }, [data]);

  if (loading && !data && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FFF7F2" }}>
        <Loader2 className="h-8 w-8 animate-spin text-[#8D294D]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center" style={{ background: "#FFF7F2" }}>
        <div>
          <h1 className="font-serif text-2xl mb-2 text-[#3B1C2B]">RSVP unavailable</h1>
          <p className="text-sm text-[#6F3E54]">{error ?? "This RSVP page is not available."}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: data.customText._rsvpBg || data.colorPalette.background }}>
      <RsvpFlow data={data} slug={slug} />
    </main>
  );
}
