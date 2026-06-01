import { useEffect } from "react";
import { apiFetch } from "@/lib/authFetch";
import { Link } from "wouter";
import { ArrowDown, BadgeDollarSign, CheckSquare, Clock3, Globe2, Heart, MailCheck, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LanguagePicker } from "@/components/LanguagePicker";
import VideoTemplate from "@/components/video/VideoTemplate";
import { LaunchPricingSection, useLaunchPricingEnabled } from "@/components/LaunchPricingSection";
import i18n, { LANG_NAME_TO_CODE } from "@/i18n";
import { organizationSchema, setSeo, softwareSchema } from "@/lib/seo";

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
  "Create your wedding profile",
  "Pick your first tools",
  "Share your website or start your guest list",
];

const HERO_REASSURANCE = [
  { icon: ShieldCheck, labelKey: "landing.reassurance_free", fallback: "Free beta access" },
  { icon: Clock3, labelKey: "landing.reassurance_minutes", fallback: "Set up in minutes" },
  { icon: CheckSquare, labelKey: "landing.reassurance_no_cc", fallback: "No credit card required" },
];

const SPARKLES = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  left: `${8 + ((i * 17) % 86)}%`,
  top: `${14 + ((i * 23) % 72)}%`,
  delay: `${(i % 6) * 0.45}s`,
}));

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

function HeroSparkles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {SPARKLES.map((sparkle) => (
        <span
          key={sparkle.id}
          className="landing-sparkle"
          style={{ left: sparkle.left, top: sparkle.top, animationDelay: sparkle.delay }}
        />
      ))}
    </div>
  );
}

export default function Landing() {
  const { t } = useTranslation();
  const launchPricingEnabled = useLaunchPricingEnabled();

  useEffect(() => {
    setSeo({
      title: "AI Wedding Planner App | A.I DO Wedding Planning Assistant",
      description: "Start wedding planning with A.I DO: a simple AI wedding planner for your wedding website, RSVPs, guest list, checklist, budget, vendors, and mobile planning.",
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
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="justify-self-start">
            <LandingLanguagePicker />
          </div>
          <nav className="hidden min-w-0 items-center justify-center gap-8 justify-self-center md:flex lg:gap-10" aria-label="Main navigation">
            <Link href="/ai-wedding-planner">
              <Button variant="ghost" className="h-10 px-2 text-base font-medium text-[#8D294D] hover:bg-transparent hover:text-[#B16C8E]">
                AI Planner
              </Button>
            </Link>
            <Link href="/wedding-website-builder">
              <Button variant="ghost" className="h-10 px-2 text-base font-medium text-[#8D294D] hover:bg-transparent hover:text-[#B16C8E]">
                Website Builder
              </Button>
            </Link>
            {launchPricingEnabled && (
              <a href="#pricing">
                <Button variant="ghost" className="h-10 px-2 text-base font-medium text-[#8D294D] hover:bg-transparent hover:text-[#B16C8E]">
                  Pricing
                </Button>
              </a>
            )}
            <Link href="/for-vendors">
              <Button variant="ghost" className="h-10 px-2 text-base font-medium text-[#8D294D] hover:bg-transparent hover:text-[#B16C8E]">
                Partner With Us
              </Button>
            </Link>
          </nav>
          <nav className="flex min-w-0 items-center justify-end gap-1.5 justify-self-end sm:gap-3" aria-label="Account navigation">
            <Link href="/early-access">
              <Button className="h-10 rounded-full bg-[linear-gradient(110deg,#E6A6B7_0%,#F2CFC6_52%,#E9A6A0_100%)] px-3 text-sm font-semibold leading-tight text-[#8D294D] shadow-[0_10px_18px_rgba(141,41,77,0.16)] hover:opacity-95 sm:h-11 sm:px-7 sm:text-base">
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
        <nav className={`mx-auto mt-2 grid max-w-7xl ${launchPricingEnabled ? "grid-cols-5" : "grid-cols-4"} gap-1.5 pb-1 text-center text-[11px] font-bold text-[#6F3E54] md:hidden`} aria-label="Popular A.I DO tools">
          <Link href="/ai-wedding-planner" className="rounded-full border border-[#E6A6B7]/45 bg-white/70 px-2 py-2">AI</Link>
          <Link href="/wedding-website-builder" className="rounded-full border border-[#E6A6B7]/45 bg-white/70 px-2 py-2">Website</Link>
          <Link href="/wedding-photo-qr-code" className="rounded-full border border-[#E6A6B7]/45 bg-white/70 px-2 py-2">Photo QR</Link>
          <Link href="/wedding-planning-checklist" className="rounded-full border border-[#E6A6B7]/45 bg-white/70 px-2 py-2">Checklist</Link>
          {launchPricingEnabled && <a href="#pricing" className="rounded-full border border-[#E6A6B7]/45 bg-white/70 px-2 py-2">Pricing</a>}
        </nav>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-[#F2E2C6] bg-[#FFF7F2]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#8D294D,#E6A6B7,#F2E2C6,#B16C8E)]" />
          <HeroSparkles />
          <div className="relative z-10 mx-auto flex min-h-[calc(100svh-132px)] max-w-5xl flex-col items-center px-4 pb-7 pt-5 text-center sm:min-h-[calc(100vh-330px)] sm:px-8 sm:pb-8 sm:pt-8">
            <img
              src="/logo.png"
              alt="A.I Do - AI Wedding Planner Assistant"
              className="h-24 w-auto object-contain drop-shadow-[0_22px_38px_rgba(141,41,77,0.16)] min-[390px]:h-28 sm:h-40"
            />
            <div className="mt-2 rounded-full border border-[#B16C8E] bg-white/[0.55] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#B16C8E] shadow-sm sm:mt-3 sm:px-5 sm:text-lg sm:tracking-[0.18em]">
              {t("landing.beta", { defaultValue: "Beta" })}
            </div>

            <div className="mt-3 inline-flex max-w-full items-center justify-center gap-2 rounded-full bg-[#F2E2C6]/[0.55] px-4 py-2 text-xs font-medium leading-snug text-[#B16C8E] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_12px_28px_rgba(141,41,77,0.08)] min-[390px]:text-sm sm:mt-5 sm:gap-3 sm:px-10 sm:py-3 sm:text-xl">
              <Sparkles className="h-4 w-4 shrink-0 text-[#E6A6B7] sm:h-5 sm:w-5" />
              <span className="min-w-0 text-balance">{t("landing.badge", { defaultValue: "AI Wedding Planner Assistant" })}</span>
            </div>

            <h1 className="mt-4 max-w-[22rem] text-balance font-serif text-[2.15rem] leading-[1.04] tracking-normal text-[#8D294D] min-[390px]:text-[2.5rem] sm:mt-6 sm:max-w-4xl sm:text-[3.7rem] sm:leading-[1.02] md:text-[4.35rem] lg:text-[4.6rem]">
              {t("landing.hero_line1", { defaultValue: "Start your wedding plan" })}
              <br />
              <span className="italic text-[#C39B70]">{t("landing.hero_line2", { defaultValue: "without the overwhelm." })}</span>
            </h1>
            <div className="mt-4 flex items-center gap-2 text-[#C39B70]" aria-hidden="true">
              <span className="h-px w-20 bg-[linear-gradient(90deg,transparent,#C39B70)]" />
              <Heart className="h-4 w-4 fill-[#E6A6B7] text-[#E6A6B7]" />
              <span className="h-px w-20 bg-[linear-gradient(90deg,#C39B70,transparent)]" />
            </div>
            <p className="mt-3 max-w-[42rem] text-pretty px-1 text-[0.94rem] leading-6 text-[#6F3E54] sm:mt-4 sm:px-0 sm:text-xl sm:leading-8">
              {t("landing.hero_desc", { defaultValue: "A.I DO gives couples one simple place to set up a wedding website, collect RSVPs, organize guests, track budget and vendors, and get AI help only when they need it." })}
            </p>

            <div className="mt-6 flex w-full max-w-3xl flex-col gap-3 px-1 sm:flex-row sm:justify-center sm:px-0">
              <Link href="/early-access">
                <Button className="h-[52px] w-full rounded-full bg-[linear-gradient(110deg,#E6A6B7_0%,#D88A96_42%,#F4C9C2_100%)] px-4 text-base font-semibold leading-tight text-white shadow-[0_20px_36px_rgba(141,41,77,0.22)] hover:opacity-95 sm:h-16 sm:min-w-72 sm:text-xl">
                  <Sparkles className="mr-1.5 h-4 w-4 shrink-0 sm:mr-2 sm:h-5 sm:w-5" />
                  <span className="min-w-0 truncate">{t("landing.cta_start", { defaultValue: "Start free beta" })}</span>
                  <Sparkles className="ml-1.5 h-4 w-4 shrink-0 sm:ml-2 sm:h-5 sm:w-5" />
                </Button>
              </Link>
              <Button
                asChild
                variant="outline"
                className="h-[52px] w-full rounded-full border-[#B16C8E]/60 bg-white/45 px-4 text-base font-semibold leading-tight text-[#8D294D] shadow-[0_14px_28px_rgba(141,41,77,0.1)] hover:bg-white/65 sm:h-16 sm:w-auto sm:min-w-56 sm:text-lg"
              >
                <a href="#preview">
                  <span>{t("landing.cta_preview", { defaultValue: "See the preview" })}</span>
                  <ArrowDown className="h-4 w-4" />
                </a>
              </Button>
            </div>

            <div className="mt-4 flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium text-[#6F3E54] sm:mt-5 sm:text-base">
              {HERO_REASSURANCE.map(({ icon: Icon, labelKey, fallback }) => (
                <div key={labelKey} className="inline-flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-[#C85F82]" />
                  <span>{t(labelKey, { defaultValue: fallback })}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 border-t border-[#E6A6B7]/30 bg-white/[0.5] px-4 py-9 backdrop-blur-sm sm:py-10">
            <div className="mx-auto max-w-7xl">
              <div className="mb-8 text-center">
                <h2 className="font-serif text-3xl leading-tight text-[#8D294D] sm:text-4xl">
                  {t("landing.top_features_title", { defaultValue: "Start with the essentials" })}
                </h2>
                <p className="mt-2 text-base text-[#6F3E54] sm:text-lg">
                  {t("landing.top_features_subtitle", { defaultValue: "The first version should feel calm: set up the basics, then use more tools when you are ready." })}
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
              <div className="mt-5 rounded-[28px] border border-[#E6A6B7]/35 bg-[linear-gradient(110deg,rgba(247,221,226,0.62),rgba(255,253,251,0.92),rgba(242,226,198,0.58))] px-5 py-5 text-center shadow-[0_14px_34px_rgba(141,41,77,0.08)]">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#B16C8E]">
                  {t("landing.features_more_label", { defaultValue: "More when you need it" })}
                </p>
                <p className="mx-auto mt-2 max-w-3xl text-pretty text-base leading-7 text-[#6F3E54]">
                  {t("landing.features_more_desc", {
                    defaultValue:
                      "After the basics, A.I DO can help with contracts, seating, photo QR uploads, day-of timelines, documents, reminders, exports, and Aria planning support.",
                  })}
                </p>
              </div>
              <div className="mt-5 rounded-[28px] border border-[#E6A6B7]/35 bg-white/78 px-5 py-6 shadow-[0_14px_34px_rgba(141,41,77,0.08)]">
                <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                  <div className="text-left">
                    <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#B16C8E]">First 5 minutes</p>
                    <h3 className="mt-2 font-serif text-2xl leading-tight text-[#8D294D] sm:text-3xl">A smoother start after signup</h3>
                    <p className="mt-2 text-sm leading-6 text-[#6F3E54] sm:text-base">
                      New couples should not land inside a giant app and wonder what to do. The first path is profile, priorities, then one clear next action.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {FIRST_FIVE_MINUTES.map((step, index) => (
                      <div key={step} className="rounded-2xl border border-[#E6A6B7]/35 bg-[#FFF7F2] p-4 text-left">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8D294D] text-sm font-bold text-white">{index + 1}</span>
                        <p className="mt-3 text-sm font-semibold leading-5 text-[#5B2035]">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 grid gap-3 text-sm font-semibold text-[#6F3E54] sm:grid-cols-2 lg:grid-cols-5">
                <Link href="/ai-wedding-planner" className="rounded-2xl border border-[#E6A6B7]/35 bg-white/70 p-4 hover:border-[#8D294D] hover:text-[#8D294D]">AI wedding planner</Link>
                <Link href="/wedding-website-builder" className="rounded-2xl border border-[#E6A6B7]/35 bg-white/70 p-4 hover:border-[#8D294D] hover:text-[#8D294D]">Wedding website builder</Link>
                <Link href="/wedding-photo-qr-code" className="rounded-2xl border border-[#E6A6B7]/35 bg-white/70 p-4 hover:border-[#8D294D] hover:text-[#8D294D]">Wedding photo QR code</Link>
                <Link href="/wedding-planning-checklist" className="rounded-2xl border border-[#E6A6B7]/35 bg-white/70 p-4 hover:border-[#8D294D] hover:text-[#8D294D]">Wedding checklist</Link>
                <Link href="/wedding-vendor-management" className="rounded-2xl border border-[#E6A6B7]/35 bg-white/70 p-4 hover:border-[#8D294D] hover:text-[#8D294D]">Vendor management</Link>
              </div>
            </div>
          </div>
        </section>

        <section id="preview" className="bg-[#FFF7F2] px-5 py-16 scroll-mt-20 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 text-center">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#B16C8E]">{t("landing.video_title", { defaultValue: "Feature Preview" })}</p>
              <h2 className="mt-3 text-balance font-serif text-3xl leading-tight text-[#8D294D] sm:text-5xl">{t("landing.video_heading", { defaultValue: "See A.I Do in motion" })}</h2>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-7 text-[#6F3E54] sm:text-lg sm:leading-8">
                {t("landing.video_desc", { defaultValue: "Watch how A.I Do keeps your budget, timeline, guests, vendor notes, and planning conversations moving together." })}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-[32px] border border-[#E6A6B7]/55 bg-white/[0.72] p-3 shadow-[0_28px_80px_rgba(141,41,77,0.18)]">
              <div className="relative aspect-[9/16] overflow-hidden rounded-[24px] bg-[#FFF7F2] sm:aspect-video">
                <VideoTemplate embedded />
              </div>
            </div>
          </div>
        </section>

        <LaunchPricingSection />
      </main>

      <footer className="border-t border-[#E6A6B7]/35 bg-[#FFF7F2] px-8 py-8 text-center text-sm text-[#8D294D]/70">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
          <img src="/logo.png" alt="A.I Do" className="h-20 w-auto object-contain" />
          <p>{t("landing.footer_brand", { defaultValue: "A.IDO - AI Wedding Planner Assistant" })}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
            <span>&copy; {new Date().getFullYear()} A.IDO. {t("landing.footer_rights", { defaultValue: "All rights reserved." })}</span>
            <Link href="/terms" className="underline-offset-4 hover:underline">{t("landing.footer_terms", { defaultValue: "Terms of Service" })}</Link>
            <Link href="/privacy" className="underline-offset-4 hover:underline">Privacy Policy</Link>
            <Link href="/beta" className="underline-offset-4 hover:underline">Beta Disclaimer</Link>
            <Link href="/security" className="underline-offset-4 hover:underline">Security</Link>
            <Link href="/data-handling" className="underline-offset-4 hover:underline">Data Handling</Link>
            <Link href="/for-vendors/apply" className="underline-offset-4 hover:underline">Vendors</Link>
            <Link href="/wedding-website-builder" className="underline-offset-4 hover:underline">Wedding Website Builder</Link>
            <Link href="/wedding-photo-qr-code" className="underline-offset-4 hover:underline">Photo QR Code</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
