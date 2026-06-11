import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowRight, BadgeDollarSign, Calculator, CheckSquare, Clock3, Globe2, Home, MailCheck, MapPin, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LanguagePicker } from "@/components/LanguagePicker";
import { LaunchPricingSection, useLaunchPricingEnabled } from "@/components/LaunchPricingSection";
import { MobileStickyCta } from "@/components/MobileStickyCta";
import i18n, { LANG_NAME_TO_CODE } from "@/i18n";
import { organizationSchema, setSeo, softwareSchema } from "@/lib/seo";
import { trackPublicMarketingEvent, trackPublicPageView } from "@/lib/publicAnalytics";

const VideoTemplate = lazy(() => import("@/components/video/VideoTemplate"));

const LANG_CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(LANG_NAME_TO_CODE).map(([name, code]) => [code, name])
);

const HERO_FEATURES = [
  {
    icon: MailCheck,
    titleKey: "landing.feature_guest_invite_title",
    descKey: "landing.feature_guest_invite_desc",
    fallbackTitle: "Guest list and RSVPs",
    fallbackDesc: "Start with names, meal choices, plus-ones, and simple RSVP tracking.",
  },
  {
    icon: Globe2,
    titleKey: "landing.feature_website_title",
    descKey: "landing.feature_website_desc",
    fallbackTitle: "Wedding website",
    fallbackDesc: "Create a shareable home for your date, location, travel, registry, and updates.",
  },
  {
    icon: CheckSquare,
    titleKey: "landing.feature_checklist_title",
    descKey: "landing.feature_checklist_desc",
    fallbackTitle: "Simple checklist",
    fallbackDesc: "See what matters next without feeling buried in planning details.",
  },
  {
    icon: BadgeDollarSign,
    titleKey: "landing.feature_vendor_budget_title",
    descKey: "landing.feature_vendor_budget_desc",
    fallbackTitle: "Budget and vendors",
    fallbackDesc: "Keep vendor names, payments, notes, and contracts together as you grow.",
  },
];

const FIRST_FIVE_MINUTES = [
  "Add your wedding date, location, and guest estimate",
  "Choose your first priority: website, RSVPs, guests, budget, or vendors",
  "Continue from the dashboard with one clear next step",
];

const HERO_REASSURANCE = [
  { icon: ShieldCheck, labelKey: "landing.reassurance_free", fallback: "Free to start" },
  { icon: CheckSquare, labelKey: "landing.reassurance_no_cc", fallback: "No credit card required" },
  { icon: Clock3, labelKey: "landing.reassurance_private", fallback: "Private by default" },
];

const CONVERSION_REASONS = [
  "Create your wedding website, RSVPs, guests, checklist, budget, and vendor plan together.",
  "Give guests one place for details while your private planning stays organized.",
  "Start with the essentials, then use AI when you need wording, next steps, or decisions.",
];

const VENUE_STYLE_OPTIONS = [
  { value: "ballroom", label: "Ballroom or hotel", multiplier: 1.06 },
  { value: "garden", label: "Garden or estate", multiplier: 1.12 },
  { value: "restaurant", label: "Restaurant", multiplier: 0.9 },
  { value: "blank", label: "Blank space", multiplier: 1.18 },
];

const PLANNING_PACE_OPTIONS = [
  { value: "early", label: "Still exploring", note: "Start with budget guardrails and must-haves." },
  { value: "touring", label: "Touring venues", note: "Compare fees, food minimums, rentals, and room blocks." },
  { value: "ready", label: "Ready to book", note: "Save your estimate, questions, and vendor notes together." },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function calculateVenueFit(guestCount: number, totalBudget: number, style: string) {
  const selectedStyle = VENUE_STYLE_OPTIONS.find((option) => option.value === style) ?? VENUE_STYLE_OPTIONS[0];
  const safeGuests = Math.max(25, Math.min(350, Math.round(guestCount || 0)));
  const safeBudget = Math.max(5000, Math.min(250000, Math.round(totalBudget || 0)));
  const venueShare = Math.round(safeBudget * 0.42 * selectedStyle.multiplier);
  const perGuestTarget = Math.round(venueShare / safeGuests);
  const low = Math.round(venueShare * 0.86);
  const high = Math.round(venueShare * 1.08);
  const guestPressure =
    perGuestTarget < 135
      ? "Tight"
      : perGuestTarget < 210
        ? "Workable"
        : "Comfortable";

  return {
    guestPressure,
    high,
    low,
    perGuestTarget,
    safeBudget,
    safeGuests,
    selectedStyle,
    venueShare,
  };
}

function LandingLanguagePicker() {
  const { i18n: activeI18n } = useTranslation();
  const currentName = LANG_CODE_TO_NAME[activeI18n.resolvedLanguage || activeI18n.language] ?? "English";

  function handleChange(lang: string) {
    const code = LANG_NAME_TO_CODE[lang] ?? "en";
    i18n.changeLanguage(code);
    localStorage.setItem("aido_language", code);
  }

  return (
    <div className="relative flex items-center">
      <LanguagePicker
        value={currentName}
        onChange={handleChange}
        variant="header"
        className="h-9 px-1 text-[#B16C8E] hover:bg-transparent hover:text-[#8D294D] [&>span]:hidden [&>svg]:h-5 [&>svg]:w-5"
      />
    </div>
  );
}

function DeferredProductPreview() {
  const [shouldLoad, setShouldLoad] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.location.hash === "#preview";
  });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function loadFromHash() {
      if (window.location.hash === "#preview") setShouldLoad(true);
    }

    loadFromHash();
    window.addEventListener("hashchange", loadFromHash);
    return () => window.removeEventListener("hashchange", loadFromHash);
  }, []);

  useEffect(() => {
    if (shouldLoad) return;
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "360px 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={containerRef} data-preview-frame className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-[#FFF7F2] sm:aspect-[4/3] lg:aspect-[16/11] xl:aspect-[16/10]">
      {shouldLoad ? (
        <Suspense fallback={<ProductPreviewSkeleton />}>
          <VideoTemplate embedded />
        </Suspense>
      ) : (
        <ProductPreviewSkeleton />
      )}
    </div>
  );
}

function ProductPreviewSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#FFF7F2,#FFFDFB,#F7DDE2)] p-6 text-center">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#B16C8E]">Preview loading</p>
        <p className="mt-3 font-serif text-3xl font-semibold text-[#8D294D]">A calm preview, without slowing the first page.</p>
      </div>
    </div>
  );
}

export default function Landing() {
  const { t } = useTranslation();
  const launchPricingEnabled = useLaunchPricingEnabled();
  const [venueCity, setVenueCity] = useState("");
  const [guestCount, setGuestCount] = useState(120);
  const [totalBudget, setTotalBudget] = useState(45000);
  const [venueStyle, setVenueStyle] = useState("ballroom");
  const [planningPace, setPlanningPace] = useState("touring");
  const [showFitResult, setShowFitResult] = useState(false);
  const venueFit = calculateVenueFit(guestCount, totalBudget, venueStyle);
  const selectedPace = PLANNING_PACE_OPTIONS.find((option) => option.value === planningPace) ?? PLANNING_PACE_OPTIONS[1];
  const venueFitSource = `landing_venue_fit_${showFitResult ? "result" : "start"}`;
  const venueFitSignupHref = `/sign-up?source=${encodeURIComponent(venueFitSource)}&guests=${venueFit.safeGuests}&budget=${venueFit.safeBudget}&venueStyle=${encodeURIComponent(venueFit.selectedStyle.value)}`;

  useEffect(() => {
    setSeo({
      title: "A.I DO | Simple AI Wedding Planner, Website, RSVP & Guest Tools",
      description: "A.I DO helps couples start wedding planning with one calm AI workspace for a wedding website, RSVPs, guests, checklist, budget, vendors, and mobile planning.",
      path: "/",
      jsonLd: [
        organizationSchema(),
        softwareSchema(
          "A.I DO AI Wedding Planner",
          "Simple AI wedding planning software for wedding websites, guest lists, RSVPs, checklists, budgets, vendors, and mobile planning.",
          "/",
        ),
      ],
    });
  }, []);

  useEffect(() => {
    trackPublicPageView("/");
  }, []);

  function trackStartPlanning(placement: string) {
    trackPublicMarketingEvent("marketing_cta_click", {
      label: "Start Planning",
      placement,
      surface: "landing",
    });
  }

  function handleVenueFitSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowFitResult(true);
    trackPublicMarketingEvent("marketing_tool_complete", {
      guestCount: venueFit.safeGuests,
      placement: "hero_venue_fit",
      planningPace,
      surface: "landing",
      tool: "venue_budget_fit",
      venueStyle,
    });
  }

  function trackVenueFitSignup() {
    trackPublicMarketingEvent("marketing_cta_click", {
      label: "Save My Venue Plan",
      placement: "hero_venue_fit_result",
      surface: "landing",
      tool: "venue_budget_fit",
    });
  }

  function focusVenueFitTool() {
    document.getElementById("venue-fit")?.scrollIntoView({ behavior: "smooth", block: "center" });
    trackPublicMarketingEvent("marketing_tool_focus", {
      placement: "mobile_sticky",
      surface: "landing",
      tool: "venue_budget_fit",
    });
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FFF7F2] pb-[calc(5.75rem+env(safe-area-inset-bottom))] text-[#8D294D] md:pb-0">
      <header className="sticky top-0 z-40 border-b border-[#E6A6B7]/70 bg-[#FFF7F2]/[0.94] px-3 py-2 shadow-[0_1px_0_rgba(141,41,77,0.06)] backdrop-blur-md sm:px-8 sm:py-3">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-2 justify-self-start sm:gap-3">
            <Link href="/" aria-label="A.I DO home" className="flex shrink-0 items-center">
              <img src="/logo-optimized.jpg" alt="A.I DO" className="h-9 w-auto object-contain sm:h-11" decoding="async" />
            </Link>
            <LandingLanguagePicker />
          </div>
          <nav className="hidden min-w-0 items-center justify-center gap-3 justify-self-center rounded-full border border-[#E6A6B7]/40 bg-white/45 px-3 py-1 shadow-[0_10px_24px_rgba(141,41,77,0.06)] md:flex lg:gap-5" aria-label="Main navigation">
            <a href="#start">
              <Button variant="ghost" className="h-9 rounded-full px-3 text-sm font-semibold text-[#8D294D] hover:bg-[#FFF7F2] hover:text-[#B16C8E] lg:text-base">
                How It Starts
              </Button>
            </a>
            <a href="#essentials">
              <Button variant="ghost" className="h-9 rounded-full px-3 text-sm font-semibold text-[#8D294D] hover:bg-[#FFF7F2] hover:text-[#B16C8E] lg:text-base">
                What You Get
              </Button>
            </a>
            <a href="#venue-fit">
              <Button variant="ghost" className="h-9 rounded-full px-3 text-sm font-semibold text-[#8D294D] hover:bg-[#FFF7F2] hover:text-[#B16C8E] lg:text-base">
                Estimate Tool
              </Button>
            </a>
            <a href="#preview">
              <Button variant="ghost" className="h-9 rounded-full px-3 text-sm font-semibold text-[#8D294D] hover:bg-[#FFF7F2] hover:text-[#B16C8E] lg:text-base">
                Product Preview
              </Button>
            </a>
            <Link href="/for-vendors">
              <Button variant="ghost" className="h-9 rounded-full px-3 text-sm font-semibold text-[#8D294D] hover:bg-[#FFF7F2] hover:text-[#B16C8E] lg:text-base">
                Partner With Us
              </Button>
            </Link>
            {launchPricingEnabled && (
              <a href="#pricing">
                <Button variant="ghost" className="h-9 rounded-full px-3 text-sm font-semibold text-[#8D294D] hover:bg-[#FFF7F2] hover:text-[#B16C8E] lg:text-base">
                  Pricing
                </Button>
              </a>
            )}
          </nav>
          <nav className="flex min-w-0 items-center justify-end gap-1.5 justify-self-end sm:gap-3" aria-label="Account navigation">
            <Link href="/sign-up">
              <Button onClick={() => trackStartPlanning("header")} className="h-10 rounded-full border border-[#8D294D]/70 bg-[#F3B6C3] px-3 text-sm font-bold leading-tight text-[#8D294D] shadow-[0_10px_18px_rgba(141,41,77,0.14)] hover:bg-[#E6A6B7] sm:h-11 sm:px-6 sm:text-base">
                <span className="sm:hidden">Start</span>
                <span className="hidden sm:inline">{t("landing.get_started", { defaultValue: "Start Planning" })}</span>
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button variant="ghost" className="h-10 px-1 text-sm font-medium text-[#8D294D] hover:bg-transparent hover:text-[#B16C8E] sm:px-2 sm:text-base">
                {t("landing.cta_signin", { defaultValue: "Sign In" })}
              </Button>
            </Link>
          </nav>
        </div>
        <nav className="mx-auto mt-2 flex max-w-7xl gap-2 overflow-x-auto pb-1 text-xs font-bold text-[#6F3E54] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden" aria-label="A.I DO sections">
          <a href="#start" className="shrink-0 rounded-full border border-[#E6A6B7]/45 bg-white/70 px-3 py-2">How It Starts</a>
          <a href="#essentials" className="shrink-0 rounded-full border border-[#E6A6B7]/45 bg-white/70 px-3 py-2">What You Get</a>
          <a href="#venue-fit" className="shrink-0 rounded-full border border-[#E6A6B7]/45 bg-white/70 px-3 py-2">Estimate Tool</a>
          <a href="#preview" className="shrink-0 rounded-full border border-[#E6A6B7]/45 bg-white/70 px-3 py-2">Product Preview</a>
          <Link href="/for-vendors" className="shrink-0 rounded-full border border-[#E6A6B7]/45 bg-white/70 px-3 py-2">Partner With Us</Link>
          {launchPricingEnabled && <a href="#pricing" className="shrink-0 rounded-full border border-[#E6A6B7]/45 bg-white/70 px-3 py-2">Pricing</a>}
        </nav>
      </header>

      <main>
        <section className="relative isolate min-h-[calc(100svh-112px)] overflow-hidden border-b border-[#E6A6B7]/35">
          <img
            src="/images/default-wedding-couple.jpg"
            alt="Couple walking together on their wedding day"
            className="absolute inset-0 h-full w-full object-cover"
            decoding="async"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,247,242,0.98)_0%,rgba(255,247,242,0.92)_44%,rgba(255,247,242,0.74)_100%)] md:bg-[linear-gradient(90deg,rgba(255,247,242,0.98)_0%,rgba(255,247,242,0.92)_47%,rgba(255,247,242,0.38)_100%)]" />
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#8D294D,#E6A6B7,#F2E2C6,#B16C8E)]" />
          <div className="relative z-10 mx-auto grid min-h-[calc(100svh-112px)] max-w-7xl items-center gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[1fr_0.82fr] lg:py-12 xl:gap-12">
            <div className="max-w-2xl text-left">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#E6A6B7]/70 bg-white/72 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#B16C8E] shadow-sm">
                <Sparkles className="h-4 w-4" />
                Free wedding planning workspace
              </div>
              <h1 className="mt-5 text-balance font-serif text-[2.75rem] leading-[0.98] tracking-normal text-[#8D294D] min-[390px]:text-[3.15rem] sm:text-6xl lg:text-7xl">
                Plan your wedding, website, guests, and RSVPs in one calm place.
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-[#4A2635] sm:text-xl sm:leading-8">
                A.I DO helps couples start with the pieces that matter first: a guest-friendly wedding website, connected RSVPs, organized guests, budget, vendors, and AI help when planning gets messy.
              </p>
              <div className="mt-5 grid gap-2 text-sm font-semibold text-[#5B2035] sm:max-w-xl">
                {CONVERSION_REASONS.map((reason) => (
                  <div key={reason} className="flex items-start gap-2">
                    <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-[#8D294D]" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
              <div className="mt-7 flex w-full sm:max-w-xl">
                <Link href="/sign-up">
                  <Button onClick={() => trackStartPlanning("hero")} className="h-[54px] w-full rounded-full bg-[#8D294D] px-6 text-base font-bold leading-tight text-white shadow-[0_20px_36px_rgba(141,41,77,0.26)] hover:bg-[#6F1D3D] sm:h-14 sm:min-w-56">
                    Start Planning
                  </Button>
                </Link>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-[#6F3E54]">
              {HERO_REASSURANCE.map(({ icon: Icon, labelKey, fallback }) => (
                <div key={labelKey} className="inline-flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-[#C85F82]" />
                  <span>{t(labelKey, { defaultValue: fallback })}</span>
                </div>
              ))}
              </div>
            </div>
            <div id="venue-fit" className="scroll-mt-28 rounded-[28px] border border-[#D4A373]/45 bg-[#FFFDFB]/92 p-4 text-[#4A2635] shadow-[0_24px_70px_rgba(61,64,47,0.16)] backdrop-blur-md sm:p-5 lg:justify-self-end">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#EEF4E8] px-3 py-1.5 text-xs font-bold text-[#3D5530]">
                    <Calculator className="h-4 w-4" />
                    Free venue fit check
                  </div>
                  <h2 className="mt-3 font-serif text-2xl leading-tight text-[#5B2035] sm:text-3xl">
                    See if your venue budget fits before you tour.
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#6F3E54]">
                    Get a quick target, then save it with your guest list, vendors, checklist, and website.
                  </p>
                </div>
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F2E2C6] text-[#6F4A1B] sm:flex">
                  <Home className="h-6 w-6" />
                </div>
              </div>

              <form className="mt-5 grid gap-3" onSubmit={handleVenueFitSubmit}>
                <label className="grid gap-1.5 text-sm font-bold text-[#5B2035]">
                  Preferred area
                  <span className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A7A42]" />
                    <input
                      value={venueCity}
                      onChange={(event) => setVenueCity(event.target.value)}
                      placeholder="City or region"
                      className="h-11 w-full rounded-2xl border border-[#D4A373]/45 bg-white px-9 text-sm font-semibold text-[#4A2635] outline-none transition focus:border-[#8D294D] focus:ring-4 focus:ring-[#E6A6B7]/30"
                    />
                  </span>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-bold text-[#5B2035]">
                    Guest count
                    <span className="relative">
                      <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A7A42]" />
                      <input
                        type="number"
                        min={25}
                        max={350}
                        value={guestCount}
                        onChange={(event) => setGuestCount(Number(event.target.value))}
                        className="h-11 w-full rounded-2xl border border-[#D4A373]/45 bg-white px-9 text-sm font-semibold text-[#4A2635] outline-none transition focus:border-[#8D294D] focus:ring-4 focus:ring-[#E6A6B7]/30"
                      />
                    </span>
                  </label>
                  <label className="grid gap-1.5 text-sm font-bold text-[#5B2035]">
                    Total budget
                    <span className="relative">
                      <BadgeDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A7A42]" />
                      <input
                        type="number"
                        min={5000}
                        max={250000}
                        step={1000}
                        value={totalBudget}
                        onChange={(event) => setTotalBudget(Number(event.target.value))}
                        className="h-11 w-full rounded-2xl border border-[#D4A373]/45 bg-white px-9 text-sm font-semibold text-[#4A2635] outline-none transition focus:border-[#8D294D] focus:ring-4 focus:ring-[#E6A6B7]/30"
                      />
                    </span>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-bold text-[#5B2035]">
                    Venue type
                    <select
                      value={venueStyle}
                      onChange={(event) => setVenueStyle(event.target.value)}
                      className="h-11 w-full rounded-2xl border border-[#D4A373]/45 bg-white px-3 text-sm font-semibold text-[#4A2635] outline-none transition focus:border-[#8D294D] focus:ring-4 focus:ring-[#E6A6B7]/30"
                    >
                      {VENUE_STYLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm font-bold text-[#5B2035]">
                    Planning stage
                    <select
                      value={planningPace}
                      onChange={(event) => setPlanningPace(event.target.value)}
                      className="h-11 w-full rounded-2xl border border-[#D4A373]/45 bg-white px-3 text-sm font-semibold text-[#4A2635] outline-none transition focus:border-[#8D294D] focus:ring-4 focus:ring-[#E6A6B7]/30"
                    >
                      {PLANNING_PACE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <Button type="submit" className="mt-1 h-12 rounded-full bg-[#3D5530] text-base font-bold text-white shadow-[0_14px_28px_rgba(61,85,48,0.22)] hover:bg-[#2F4325]">
                  Show my venue fit
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>

              <div className={`mt-4 overflow-hidden rounded-[22px] border transition-all duration-300 ${showFitResult ? "border-[#D4A373]/55 bg-[#F8F4EA] p-4 opacity-100" : "max-h-0 border-transparent p-0 opacity-0"}`} aria-live="polite">
                {showFitResult && (
                  <div>
                    <p className="text-xs font-bold text-[#3D5530]">
                      {venueCity.trim() ? `${venueCity.trim()} estimate` : "Your quick estimate"}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold text-[#6F3E54]">Venue target</p>
                        <p className="text-lg font-black text-[#5B2035]">{formatCurrency(venueFit.low)}-{formatCurrency(venueFit.high)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#6F3E54]">Per guest</p>
                        <p className="text-lg font-black text-[#5B2035]">{formatCurrency(venueFit.perGuestTarget)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#6F3E54]">Fit</p>
                        <p className="text-lg font-black text-[#5B2035]">{venueFit.guestPressure}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#4A2635]">
                      {selectedPace.note} A.I DO can turn this into a saved checklist, venue questions, RSVP plan, and budget tracker.
                    </p>
                    <Button asChild className="mt-4 h-11 w-full rounded-full bg-[#8D294D] text-sm font-bold text-white hover:bg-[#6F1D3D]">
                      <Link href={venueFitSignupHref} onClick={trackVenueFitSignup}>
                        Save my venue plan
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
              <p className="mt-3 text-center text-xs font-semibold text-[#7A5062]">
                See the estimate first. Sign up only when you want to save it.
              </p>
            </div>
          </div>
        </section>

        <section id="start" className="scroll-mt-24 bg-[#FFFDFB] px-4 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto grid max-w-7xl gap-7 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#B16C8E]">First 5 minutes</p>
              <h2 className="mt-3 text-balance font-serif text-3xl leading-tight text-[#8D294D] sm:text-5xl">
                Sign up, then get one clear next step.
              </h2>
              <p className="mt-4 text-base leading-7 text-[#6F3E54] sm:text-lg sm:leading-8">
                Couples should not land inside a giant app and wonder what to do. A.I DO helps you set up the basics first, then keeps the rest organized as the wedding grows.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {FIRST_FIVE_MINUTES.map((step, index) => (
                <div key={step} className="rounded-[24px] border border-[#E6A6B7]/35 bg-[#FFF7F2] p-5 shadow-[0_14px_34px_rgba(141,41,77,0.08)]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8D294D] text-sm font-bold text-white">{index + 1}</span>
                  <p className="mt-4 text-base font-bold leading-6 text-[#5B2035]">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="essentials" className="scroll-mt-24 bg-[#FFF7F2] px-4 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto mb-8 max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#B16C8E]">What you get first</p>
              <h2 className="mt-3 font-serif text-3xl leading-tight text-[#8D294D] sm:text-5xl">
                The wedding tools couples actually need to start.
              </h2>
              <p className="mt-3 text-base leading-7 text-[#6F3E54] sm:text-lg">
                Start with the essentials. The advanced tools stay available when your planning gets more detailed.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                {HERO_FEATURES.map(({ icon: Icon, titleKey, descKey, fallbackTitle, fallbackDesc }) => (
                  <div
                    key={titleKey}
                    className="group flex min-h-0 flex-col rounded-2xl border border-[#E6A6B7]/35 bg-[#FFFDFB]/88 p-5 text-left text-[#8D294D] shadow-[0_16px_38px_rgba(141,41,77,0.08)] transition duration-300 hover:-translate-y-1 hover:border-[#D4A373]/55 hover:shadow-[0_24px_54px_rgba(141,41,77,0.13)] sm:min-h-64 sm:rounded-[28px] sm:p-6"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F7DDE2] text-[#C39B70] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_22px_rgba(141,41,77,0.1)] transition duration-300 group-hover:bg-[#F2E2C6] group-hover:text-[#8D294D] sm:h-14 sm:w-14">
                      <Icon className="h-7 w-7 stroke-[1.6] sm:h-8 sm:w-8" />
                    </span>
                    <h3 className="mt-4 text-balance font-serif text-xl font-bold leading-tight text-[#6F1D3D] sm:mt-5 sm:text-2xl">
                      {t(titleKey, { defaultValue: fallbackTitle })}
                    </h3>
                    <div className="my-3 h-px w-full bg-[#E6A6B7]/35 sm:my-4" />
                    <p className="text-pretty text-sm leading-6 text-[#6F3E54] sm:text-base sm:leading-7">
                      {t(descKey, { defaultValue: fallbackDesc })}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </section>

        <section id="preview" className="scroll-mt-24 bg-[#FFFDFB] px-4 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[0.75fr_1.25fr] xl:items-center">
            <div className="mx-auto max-w-3xl text-center xl:mx-0 xl:max-w-md xl:text-left">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#B16C8E]">Product preview</p>
              <h2 className="mt-3 text-balance font-serif text-3xl leading-tight text-[#8D294D] sm:text-5xl">
                See how the planning pieces come together.
              </h2>
              <p className="mt-4 text-base leading-7 text-[#6F3E54] sm:text-lg sm:leading-8">
                Preview the flow before signing up: profile, guests, RSVPs, website, budget, vendors, and photo QR in one connected workspace.
              </p>
            </div>
            <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-[30px] border border-[#E6A6B7]/45 bg-white/78 p-2 shadow-[0_24px_70px_rgba(141,41,77,0.16)] sm:p-3">
              <DeferredProductPreview />
            </div>
          </div>
        </section>

        <section className="bg-[#FFF7F2] px-4 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-6 rounded-[32px] border border-[#E6A6B7]/40 bg-[linear-gradient(110deg,rgba(255,247,242,0.96),rgba(255,255,255,0.86),rgba(247,221,226,0.64))] p-6 shadow-[0_22px_58px_rgba(141,41,77,0.12)] md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#B16C8E]">Start planning</p>
              <h2 className="mt-3 text-balance font-serif text-3xl leading-tight text-[#8D294D] sm:text-5xl">
                Create your wedding workspace in minutes.
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#6F3E54] sm:text-lg">
                Start with a calm place for your website, RSVPs, guests, checklist, vendors, budget, and planning support.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:min-w-72">
              <Button asChild className="h-[52px] rounded-full bg-[#8D294D] px-7 text-base font-bold text-white hover:bg-[#6F1D3D]">
                <Link href="/sign-up" onClick={() => trackStartPlanning("final_cta")}>Start Planning</Link>
              </Button>
              <p className="text-center text-xs font-bold uppercase tracking-[0.16em] text-[#7A5062]">No credit card required</p>
            </div>
          </div>
        </section>

        <LaunchPricingSection enabled={launchPricingEnabled} />
      </main>

      <footer className="border-t border-[#E6A6B7]/35 bg-[#FFF7F2] px-8 py-8 text-center text-sm text-[#8D294D]/70">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
          <img src="/logo-optimized.jpg" alt="A.I Do" className="h-20 w-auto object-contain" loading="lazy" decoding="async" />
          <p>{t("landing.footer_brand", { defaultValue: "A.IDO - AI Wedding Planner Assistant" })}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
            <span>&copy; {new Date().getFullYear()} A.IDO. {t("landing.footer_rights", { defaultValue: "All rights reserved." })}</span>
            <Link href="/terms" className="underline-offset-4 hover:underline">{t("landing.footer_terms", { defaultValue: "Terms of Service" })}</Link>
            <Link href="/privacy" className="underline-offset-4 hover:underline">Privacy Policy</Link>
            <Link href="/security" className="underline-offset-4 hover:underline">Security</Link>
            <Link href="/data-handling" className="underline-offset-4 hover:underline">Data Handling</Link>
            <Link href="/for-vendors/apply" className="underline-offset-4 hover:underline">Vendors</Link>
          </div>
        </div>
      </footer>
      <MobileStickyCta
        buttonLabel="Estimate"
        detail="Then save your plan"
        label="Check your venue budget fit"
        onClick={focusVenueFitTool}
      />
    </div>
  );
}
