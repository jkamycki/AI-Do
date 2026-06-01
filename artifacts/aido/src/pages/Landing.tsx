import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/authFetch";
import { Link } from "wouter";
import { BadgeDollarSign, CheckSquare, Clock3, Globe2, MailCheck, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LanguagePicker } from "@/components/LanguagePicker";
import { LaunchPricingSection, useLaunchPricingEnabled } from "@/components/LaunchPricingSection";
import i18n, { LANG_NAME_TO_CODE } from "@/i18n";
import { organizationSchema, setSeo, softwareSchema } from "@/lib/seo";

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
  "Tell A.I DO your date, location, and guest estimate",
  "Choose what you want to handle first",
  "Launch your website or start your guest list",
];

const HERO_REASSURANCE = [
  { icon: ShieldCheck, labelKey: "landing.reassurance_free", fallback: "Free beta access" },
  { icon: Clock3, labelKey: "landing.reassurance_minutes", fallback: "Set up in minutes" },
  { icon: CheckSquare, labelKey: "landing.reassurance_no_cc", fallback: "No credit card required" },
];

const CONVERSION_REASONS = [
  "Stop switching between spreadsheets, notes, texts, and wedding website tools.",
  "Give guests one place for the details while you keep the plan organized.",
  "Use AI for the stressful parts, not for everything.",
];

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

function DeferredDemoVideo() {
  const [shouldLoad, setShouldLoad] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
    <div ref={containerRef} className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-[#FFF7F2] sm:aspect-[16/10] lg:aspect-[16/9] xl:aspect-[16/10]">
      {shouldLoad ? (
        <Suspense fallback={<DemoVideoSkeleton />}>
          <VideoTemplate embedded />
        </Suspense>
      ) : (
        <DemoVideoSkeleton />
      )}
    </div>
  );
}

function DemoVideoSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#FFF7F2,#FFFDFB,#F7DDE2)] p-6 text-center">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#B16C8E]">Demo loading soon</p>
        <p className="mt-3 font-serif text-3xl font-semibold text-[#8D294D]">A calm preview, without slowing the first page.</p>
      </div>
    </div>
  );
}

export default function Landing() {
  const { t } = useTranslation();
  const launchPricingEnabled = useLaunchPricingEnabled();

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
    let vid = localStorage.getItem("aido_vid");
    if (!vid) {
      vid = crypto.randomUUID();
      localStorage.setItem("aido_vid", vid);
    }
    apiFetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: vid, path: "/" }),
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FFF7F2] text-[#8D294D]">
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
            <a href="#demo">
              <Button variant="ghost" className="h-9 rounded-full px-3 text-sm font-semibold text-[#8D294D] hover:bg-[#FFF7F2] hover:text-[#B16C8E] lg:text-base">
                Watch Demo
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
            <Link href="/early-access">
              <Button className="h-10 rounded-full border border-[#8D294D]/70 bg-[#F3B6C3] px-3 text-sm font-bold leading-tight text-[#8D294D] shadow-[0_10px_18px_rgba(141,41,77,0.14)] hover:bg-[#E6A6B7] sm:h-11 sm:px-6 sm:text-base">
                <span className="sm:hidden">Join Beta</span>
                <span className="hidden sm:inline">{t("landing.get_started", { defaultValue: "Join Founding Couples" })}</span>
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
          <a href="#demo" className="shrink-0 rounded-full border border-[#E6A6B7]/45 bg-white/70 px-3 py-2">Watch Demo</a>
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
          <div className="relative z-10 mx-auto flex min-h-[calc(100svh-112px)] max-w-7xl items-center px-4 py-10 sm:px-8 lg:py-16">
            <div className="max-w-2xl text-left">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#E6A6B7]/70 bg-white/72 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#B16C8E] shadow-sm">
                <Sparkles className="h-4 w-4" />
                Free beta for founding couples
              </div>
              <h1 className="mt-5 text-balance font-serif text-[2.75rem] leading-[0.98] tracking-normal text-[#8D294D] min-[390px]:text-[3.15rem] sm:text-6xl lg:text-7xl">
                A calmer way to plan your wedding.
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-[#4A2635] sm:text-xl sm:leading-8">
                Build your wedding website, collect RSVPs, organize guests, track budget and vendors, and get AI help from one simple workspace.
              </p>
              <div className="mt-5 grid gap-2 text-sm font-semibold text-[#5B2035] sm:max-w-xl">
                {CONVERSION_REASONS.map((reason) => (
                  <div key={reason} className="flex items-start gap-2">
                    <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-[#8D294D]" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
              <div className="mt-7 flex w-full flex-col gap-3 sm:max-w-xl sm:flex-row">
              <Link href="/early-access">
                <Button className="h-[54px] w-full rounded-full bg-[#8D294D] px-6 text-base font-bold leading-tight text-white shadow-[0_20px_36px_rgba(141,41,77,0.26)] hover:bg-[#6F1D3D] sm:h-14 sm:min-w-56">
                  Join free beta
                </Button>
              </Link>
              <Button asChild variant="outline" className="h-[54px] w-full rounded-full border-[#B16C8E]/60 bg-white/72 px-6 text-base font-bold leading-tight text-[#8D294D] shadow-[0_14px_28px_rgba(141,41,77,0.1)] hover:bg-white sm:h-14 sm:w-auto">
                <a href="#start">See the first steps</a>
              </Button>
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
          </div>
        </section>

        <section id="start" className="scroll-mt-24 bg-[#FFFDFB] px-4 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto grid max-w-7xl gap-7 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#B16C8E]">First 5 minutes</p>
              <h2 className="mt-3 text-balance font-serif text-3xl leading-tight text-[#8D294D] sm:text-5xl">
                Start small, then plan deeper when you are ready.
              </h2>
              <p className="mt-4 text-base leading-7 text-[#6F3E54] sm:text-lg sm:leading-8">
                Couples should not land inside a giant app and wonder what to do. A.I DO guides the first setup into one clear next action.
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
            <div className="mt-6 grid gap-4 rounded-[28px] border border-[#E6A6B7]/35 bg-white/76 p-5 shadow-[0_14px_34px_rgba(141,41,77,0.08)] md:grid-cols-[1fr_1fr_auto] md:items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#B16C8E]">More when you need it</p>
                <p className="mt-2 text-sm leading-6 text-[#6F3E54] sm:text-base">
                  Contracts, seating, photo QR uploads, day-of timelines, documents, reminders, exports, and Aria planning support.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-[#6F3E54]">
                {["Contracts", "Seating", "Photo QR", "Day-of", "Documents", "Aria"].map((item) => (
                  <span key={item} className="rounded-full bg-[#FFF7F2] px-3 py-2">{item}</span>
                ))}
              </div>
              <Button asChild variant="outline" className="h-11 rounded-full border-[#B16C8E]/55 bg-white text-[#8D294D]">
                <a href="#demo">See it</a>
              </Button>
            </div>
          </div>
        </section>

        <section id="demo" className="scroll-mt-24 bg-[#FFFDFB] px-4 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[0.75fr_1.25fr] xl:items-center">
            <div className="mx-auto max-w-3xl text-center xl:mx-0 xl:max-w-md xl:text-left">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#B16C8E]">Quick demo</p>
              <h2 className="mt-3 text-balance font-serif text-3xl leading-tight text-[#8D294D] sm:text-5xl">
                See how the planning pieces come together.
              </h2>
              <p className="mt-4 text-base leading-7 text-[#6F3E54] sm:text-lg sm:leading-8">
                The video is here for couples who want to feel the product before signing up. It should build trust, not slow down the page.
              </p>
            </div>
            <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-[30px] border border-[#E6A6B7]/45 bg-white/78 p-2 shadow-[0_24px_70px_rgba(141,41,77,0.16)] sm:p-3">
              <DeferredDemoVideo />
            </div>
          </div>
        </section>

        <section className="bg-[#FFF7F2] px-4 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-6 rounded-[32px] border border-[#E6A6B7]/40 bg-[linear-gradient(110deg,rgba(255,247,242,0.96),rgba(255,255,255,0.86),rgba(247,221,226,0.64))] p-6 shadow-[0_22px_58px_rgba(141,41,77,0.12)] md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#B16C8E]">Founding couples</p>
              <h2 className="mt-3 text-balance font-serif text-3xl leading-tight text-[#8D294D] sm:text-5xl">
                Help shape A.I DO before public launch.
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#6F3E54] sm:text-lg">
                Free beta access gives you a calm place to start planning while your feedback helps decide what should launch next.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:min-w-72">
              <Button asChild className="h-[52px] rounded-full bg-[#8D294D] px-7 text-base font-bold text-white hover:bg-[#6F1D3D]">
                <Link href="/early-access">Reserve beta spot</Link>
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
            <Link href="/beta" className="underline-offset-4 hover:underline">Beta Disclaimer</Link>
            <Link href="/security" className="underline-offset-4 hover:underline">Security</Link>
            <Link href="/data-handling" className="underline-offset-4 hover:underline">Data Handling</Link>
            <Link href="/for-vendors/apply" className="underline-offset-4 hover:underline">Vendors</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
