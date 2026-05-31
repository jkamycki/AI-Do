import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { apiFetch } from "@/lib/authFetch";
import { ArrowDown, Loader2 } from "lucide-react";
import { RsvpFlow } from "@/components/website/RsvpFlow";
import type { WebsiteRendererPayload } from "@/components/website/WebsiteRenderer";
import {
  AiDigitalInvitationPreview,
  type CustomColors,
  type PhotoPosition,
  type WeddingInfo,
} from "@/components/InvitationCustomization/AiPreviewComponents";
import type { ColorPalette } from "@/types/invitations";
import { MaintenanceNotice } from "@/components/MaintenanceNotice";
import { usePublicMaintenance } from "@/hooks/usePublicMaintenance";
import { coupleFirstNames } from "@/lib/coupleNames";

interface PublicSitePayload extends WebsiteRendererPayload {
  slug: string;
  invitationPreview?: {
    profile: WeddingInfo;
    photoUrl?: string | null;
    photoPosition?: PhotoPosition;
    photoZoom?: number;
    photoEffect?: string | null;
    customColors?: CustomColors | null;
  };
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
  const [, params] = useRoute("/rsvp/shared/:token");
  const token = params?.token ?? "";
  const [data, setData] = useState<PublicSitePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRsvp, setShowRsvp] = useState(false);
  const maintenance = usePublicMaintenance("rsvp");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setData(null);
    setShowRsvp(false);
    apiFetch(`/api/invitation-shares/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.status === 404) {
          setError("This RSVP page doesn't exist or is no longer available.");
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
  }, [token]);

  useEffect(() => {
    if (!data) {
      document.title = "RSVP";
      return;
    }
    const couple = coupleFirstNames(data.couple.partner2Name, data.couple.partner1Name);
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

  if (maintenance.data?.active) {
    return <MaintenanceNotice message={maintenance.data.message} />;
  }

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
      {!showRsvp ? (
        <section className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6">
            <div className="w-full max-w-[520px]">
              <AiDigitalInvitationPreview
                profile={data.invitationPreview?.profile ?? {
                  partner1Name: data.couple.partner1Name,
                  partner2Name: data.couple.partner2Name,
                  weddingDate: data.couple.weddingDate,
                  venue: data.couple.venue,
                  venueAddress: data.couple.location,
                  venueCity: data.couple.venueCity,
                  venueState: data.couple.venueState,
                  ceremonyTime: data.couple.ceremonyTime,
                  receptionTime: data.couple.receptionTime,
                  websiteUrl: data.publicWebsiteUrl ?? null,
                  guestName: "Guest",
                }}
                palette={data.colorPalette as ColorPalette}
                photoUrl={data.invitationPreview?.photoUrl ?? data.heroImage}
                photoPosition={data.invitationPreview?.photoPosition}
                photoZoom={data.invitationPreview?.photoZoom}
                photoEffect={data.invitationPreview?.photoEffect}
                customColors={data.invitationPreview?.customColors ?? undefined}
                onRsvpClick={() => setShowRsvp(true)}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowRsvp(true)}
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-sm transition hover:opacity-90"
              style={{ background: data.colorPalette.primary, color: "#fff" }}
            >
              RSVP Now <ArrowDown className="h-4 w-4" />
            </button>
          </div>
        </section>
      ) : (
        <RsvpFlow data={data} slug={token} sharedToken={token} />
      )}
    </main>
  );
}
