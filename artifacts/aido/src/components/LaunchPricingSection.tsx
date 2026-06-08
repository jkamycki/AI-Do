import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/authFetch";
import { trackPublicMarketingEvent } from "@/lib/publicAnalytics";

type PricingVisibility = {
  enabled: boolean;
};

const freeFeatures = [
  "Wedding website with A.I DO URL",
  "Basic RSVP and guest list",
  "Checklist and budget tracker",
  "Registry links and travel details",
  "Basic photo drop QR",
  "Limited AI planner messages",
];

const completeFeatures = [
  "Premium website designs",
  "Remove A.I DO branding",
  "Advanced RSVP, meal choices, and exports",
  "Seating chart, vendor tracker, and payment reminders",
  "Invitation studio with digital Save the Dates and invitations",
  "Contract/document AI review and day-of timeline",
  "Advanced photo QR/disposable camera",
  "Partner/planner collaboration and priority support",
];

export function useLaunchPricingEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/pricing/public", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as PricingVisibility;
        if (!cancelled) setEnabled(body.enabled === true);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-3 text-left">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm font-medium leading-6 text-[#5B2035] sm:text-base">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#8D294D]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function trackPricingCta(plan: string) {
  trackPublicMarketingEvent("marketing_cta_click", {
    label: "Start Planning",
    placement: "pricing",
    plan,
    surface: "pricing_section",
  });
}

export function LaunchPricingSection({ compact = false, enabled: controlledEnabled }: { compact?: boolean; enabled?: boolean }) {
  const fetchedEnabled = useLaunchPricingEnabled();
  const enabled = controlledEnabled ?? fetchedEnabled;
  if (!enabled) return null;

  return (
    <section id="pricing" className={`${compact ? "px-4 py-12 sm:px-5 sm:py-14" : "bg-[#FFF7F2] px-5 py-16 sm:px-8 sm:py-20"} scroll-mt-20`}>
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.26em] text-[#B16C8E]">Launch Pricing</p>
          <h2 className="mt-3 text-balance font-serif text-3xl leading-tight text-[#8D294D] sm:text-5xl">
            Start planning, upgrade only when you want the full wedding suite.
          </h2>
          <p className="mt-4 text-pretty text-base leading-7 text-[#6F3E54] sm:text-lg sm:leading-8">
            Simple founding couple pricing for launch: use the basics free, pay monthly while you plan, or choose one payment for the full wedding.
          </p>
        </div>

        <div className="mt-9 grid gap-4 lg:grid-cols-3 lg:items-stretch">
          <article className="rounded-[28px] border border-[#E6A6B7]/40 bg-white/78 p-6 shadow-[0_18px_48px_rgba(141,41,77,0.09)] sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#B16C8E]">Free</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="font-serif text-5xl text-[#8D294D]">$0</span>
              <span className="pb-2 text-sm font-semibold text-[#6F3E54]">to start</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#6F3E54] sm:text-base">
              For couples who want a beautiful wedding website and the planning basics without a credit card.
            </p>
            <FeatureList items={freeFeatures} />
            <Button asChild variant="outline" className="mt-7 h-12 w-full rounded-full border-[#B16C8E]/55 bg-white/70 text-[#8D294D] hover:bg-white">
              <Link href="/sign-up" onClick={() => trackPricingCta("free")}>Start Planning</Link>
            </Button>
          </article>

          <article className="relative overflow-hidden rounded-[28px] border border-[#8D294D]/45 bg-white/88 p-6 shadow-[0_18px_48px_rgba(141,41,77,0.11)] sm:p-8">
            <div className="absolute right-5 top-5 rounded-full bg-[#F7DDE2] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#8D294D]">
              Softer start
            </div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#B16C8E]">A.I DO Complete Monthly</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <span className="font-serif text-5xl text-[#8D294D]">$9</span>
              <span className="pb-2 text-sm font-semibold text-[#6F3E54]">per month</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#6F3E54] sm:text-base">
              For couples who want the complete toolkit but prefer a smaller monthly payment while planning.
            </p>
            <FeatureList items={completeFeatures} />
            <Button asChild className="mt-7 h-12 w-full rounded-full bg-[#8D294D] text-white hover:bg-[#6F1D3D]">
              <Link href="/sign-up" onClick={() => trackPricingCta("complete_monthly")}>
                <Sparkles className="h-4 w-4" />
                Start Planning
              </Link>
            </Button>
          </article>

          <article className="relative overflow-hidden rounded-[28px] border border-[#8D294D]/45 bg-[linear-gradient(140deg,#8D294D_0%,#B16C8E_52%,#D88A96_100%)] p-6 text-white shadow-[0_28px_72px_rgba(141,41,77,0.24)] sm:p-8">
            <div className="absolute right-5 top-5 rounded-full bg-white/18 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-white">
              Best value
            </div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-white/82">A.I DO Complete One-Time</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <span className="font-serif text-5xl">$99</span>
              <span className="pb-2 text-sm font-semibold text-white/82">one-time per wedding</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/88 sm:text-base">
              For couples who want the complete app and website experience from planning through the wedding day.
            </p>
            <ul className="mt-5 space-y-3 text-left">
              {completeFeatures.map((item) => (
                <li key={item} className="flex gap-3 text-sm font-medium leading-6 text-white sm:text-base">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#F8DDE5]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button asChild className="mt-7 h-12 w-full rounded-full bg-white text-[#8D294D] hover:bg-[#FFF7F2]">
              <Link href="/sign-up" onClick={() => trackPricingCta("complete_one_time")}>
                <Sparkles className="h-4 w-4" />
                Start Planning
              </Link>
            </Button>
          </article>
        </div>
      </div>
    </section>
  );
}
