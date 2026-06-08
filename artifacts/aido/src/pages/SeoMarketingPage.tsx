import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, CheckCircle2, Globe2, MailCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LaunchPricingSection } from "@/components/LaunchPricingSection";
import { organizationSchema, setSeo, softwareSchema } from "@/lib/seo";
import { trackPublicMarketingEvent } from "@/lib/publicAnalytics";

type PageKey =
  | "ai-wedding-planner"
  | "wedding-website-builder"
  | "digital-invitations"
  | "pricing";

const PAGE_CONTENT: Record<PageKey, {
  title: string;
  metaTitle: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  icon: typeof Sparkles;
  bullets: string[];
}> = {
  "ai-wedding-planner": {
    title: "AI Wedding Planner",
    metaTitle: "AI Wedding Planner App | A.I DO Wedding Planning Assistant",
    description: "Use A.I DO as your AI wedding planner for budgets, timelines, guest lists, vendor emails, RSVPs, contracts, seating charts, and day-of coordination.",
    eyebrow: "AI wedding planner app",
    h1: "Plan your wedding faster with an AI wedding planner built for real couples.",
    intro: "A.I DO helps couples turn scattered wedding details into a clear planning workspace: guest management, budget tracking, vendor notes, invitations, contracts, timelines, and day-of tools in one place.",
    icon: Sparkles,
    bullets: ["AI planning assistant for next steps and wording", "Budget, checklist, timeline, and vendor workspace", "Guest list, RSVP, wedding website, and photo QR tools"],
  },
  "wedding-website-builder": {
    title: "Wedding Website Builder",
    metaTitle: "Wedding Website Builder With RSVP & QR Codes | A.I DO",
    description: "Build a wedding website with RSVP tools, QR codes, guest photo drop, registry links, hotel details, schedules, and custom sections in A.I DO.",
    eyebrow: "Wedding website builder",
    h1: "Wedding websites guests can actually use.",
    intro: "Build and publish a personalized wedding website with home, story, schedule, travel, registry, wedding party, gallery, FAQ, RSVP, and QR-code sharing tools.",
    icon: Globe2,
    bullets: ["Guest-friendly wedding website pages", "Website QR code and RSVP QR code generation", "Password protection, gallery controls, and photo drop"],
  },
  "digital-invitations": {
    title: "Digital Wedding Invitations",
    metaTitle: "Digital Wedding Invitations With RSVP Tracking | A.I DO",
    description: "Send digital wedding invitations, collect RSVPs, organize guests, manage meal choices, and connect invitation replies to your A.I DO planning dashboard.",
    eyebrow: "Digital wedding invitations",
    h1: "Send digital invitations and keep every RSVP connected to the plan.",
    intro: "A.I DO helps couples manage digital invites, RSVP replies, guest details, meal choices, plus-ones, and wedding website links from one planning workspace.",
    icon: MailCheck,
    bullets: ["Digital invitation and save-the-date flows", "RSVP status, meal choices, and guest notes", "Connected guest list, website, and planning dashboard"],
  },
  "pricing": {
    title: "A.I DO Pricing",
    metaTitle: "A.I DO Pricing | Wedding Planning App Plans",
    description: "Compare A.I DO wedding planning app pricing, including planning tools, website builder, guest tools, vendor tracking, and AI planning help.",
    eyebrow: "Wedding planning app pricing",
    h1: "Start planning, then choose the plan that fits your wedding.",
    intro: "A.I DO keeps pricing simple for couples: start free, explore the workspace, and upgrade when you are ready for paid planning features.",
    icon: Sparkles,
    bullets: ["No credit card required to start", "Simple monthly or annual paid plan when launch pricing is enabled", "Website, guest, vendor, budget, checklist, and AI planning tools"],
  },
};

function pageKeyFromPath(path: string): PageKey {
  const normalized = path.replace(/^\/+|\/+$/g, "");
  const key = normalized as PageKey;
  return PAGE_CONTENT[key] ? key : "ai-wedding-planner";
}

function signupHref(source: string) {
  return `/sign-up?source=${encodeURIComponent(source)}`;
}

export default function SeoMarketingPage() {
  const [location, setLocation] = useLocation();
  const key = pageKeyFromPath(location);
  const page = PAGE_CONTENT[key];
  const Icon = page.icon;
  const [quickStartEmail, setQuickStartEmail] = useState("");

  function trackStartPlanning(placement: string) {
    trackPublicMarketingEvent("marketing_cta_click", {
      label: "Start Planning",
      placement,
      surface: key,
    });
  }

  function handleQuickStartSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = quickStartEmail.trim();
    if (!email) return;
    trackPublicMarketingEvent("marketing_quick_start_submit", {
      placement: "hero_email",
      surface: key,
    });
    setLocation(`/sign-up?email=${encodeURIComponent(email)}&source=${encodeURIComponent(key)}`);
  }

  useEffect(() => {
    setSeo({
      title: page.metaTitle,
      description: page.description,
      path: `/${key}`,
      jsonLd: [
        organizationSchema(),
        softwareSchema(page.title, page.description, `/${key}`),
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "A.I DO", item: "https://aidowedding.net/" },
            { "@type": "ListItem", position: 2, name: page.title, item: `https://aidowedding.net/${key}` },
          ],
        },
      ],
    });
  }, [key, page]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#FFF7F2] text-[#5B2035]">
      <header className="border-b border-[#E6A6B7]/45 bg-[#FFF7F2]/95 px-4 py-3 backdrop-blur sm:px-5 sm:py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-serif text-2xl text-[#8D294D]">
            <img src="/logo-optimized.jpg" alt="A.I DO" className="h-10 w-auto shrink-0 sm:h-12" decoding="async" />
          </Link>
          <nav className="hidden items-center gap-4 text-sm font-semibold text-[#6F3E54] md:flex">
            <Link href="/wedding-website-builder" className="hover:text-[#8D294D]">Website Builder</Link>
            <Link href="/digital-invitations" className="hover:text-[#8D294D]">Invitations & RSVP</Link>
            <Link href="/for-vendors" className="hover:text-[#8D294D]">Vendors</Link>
          </nav>
          <Button asChild className="h-10 shrink-0 rounded-full bg-[#8D294D] px-4 text-sm text-white hover:bg-[#6F1D3D] sm:px-5">
            <Link href={signupHref(`${key}_header`)} onClick={() => trackStartPlanning("header")}>Start Planning</Link>
          </Button>
        </div>
        <nav className="mx-auto mt-3 grid max-w-6xl grid-cols-5 gap-1.5 pb-1 text-center text-[11px] font-bold text-[#6F3E54] md:hidden" aria-label="Related wedding tools">
          <Link href="/" className="rounded-full border border-[#E6A6B7]/45 bg-white/70 px-1.5 py-2">Home</Link>
          <Link href="/wedding-website-builder" className="rounded-full border border-[#E6A6B7]/45 bg-white/70 px-1.5 py-2">Web</Link>
          <Link href="/digital-invitations" className="rounded-full border border-[#E6A6B7]/45 bg-white/70 px-1.5 py-2">RSVP</Link>
          <Link href="/ai-wedding-planner" className="rounded-full border border-[#E6A6B7]/45 bg-white/70 px-1.5 py-2">AI</Link>
          <Link href="/for-vendors" className="rounded-full border border-[#E6A6B7]/45 bg-white/70 px-1.5 py-2">Vendors</Link>
        </nav>
      </header>

      <section className="px-4 py-12 sm:px-5 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-7 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#E6A6B7]/60 bg-white/65 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#B16C8E] sm:px-4 sm:text-sm sm:tracking-[0.18em]">
              <Icon className="h-4 w-4" />
              <span className="min-w-0 truncate">{page.eyebrow}</span>
            </div>
            <h1 className="mt-5 max-w-3xl text-balance font-serif text-[2.35rem] leading-[1.05] text-[#8D294D] sm:mt-6 sm:text-6xl">
              {page.h1}
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-[#6F3E54] sm:mt-5 sm:text-lg sm:leading-8">
              {page.intro}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-12 w-full rounded-full bg-[#8D294D] px-6 text-white hover:bg-[#6F1D3D] sm:w-auto">
                <Link href={signupHref(`${key}_hero`)} onClick={() => trackStartPlanning("hero")}>Start Planning <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#8D294D]/25 bg-white/82 p-4 shadow-[0_24px_70px_rgba(141,41,77,0.12)] sm:rounded-[2rem] sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#B16C8E] sm:text-sm sm:tracking-[0.22em]">Start free</p>
            <h2 className="mt-3 font-serif text-2xl font-semibold leading-tight text-[#8D294D] sm:text-3xl">
              Create your wedding workspace now.
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[#6F3E54]">
              Enter your email and we will start your private workspace with this tool ready first.
            </p>
            <form onSubmit={handleQuickStartSubmit} className="mt-5 grid gap-3">
              <label className="sr-only" htmlFor="marketing-quick-start-email">Email address</label>
              <input
                id="marketing-quick-start-email"
                type="email"
                required
                value={quickStartEmail}
                onChange={(event) => setQuickStartEmail(event.target.value)}
                placeholder="Your email address"
                autoComplete="email"
                className="h-12 w-full rounded-full border border-[#E6A6B7]/65 bg-white px-4 text-sm font-semibold text-[#3B1C2B] outline-none transition placeholder:text-[#8D294D]/45 focus:border-[#8D294D] focus:ring-4 focus:ring-[#E6A6B7]/30"
              />
              <Button type="submit" className="h-12 w-full rounded-full bg-[#8D294D] px-5 font-bold text-white hover:bg-[#6F1D3D]">
                Continue free <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-[#6F3E54]">
              <span>No credit card</span>
              <span>Email code sign-in</span>
              <span>Private by default</span>
            </div>
            <div className="mt-5 space-y-3 border-t border-[#E6A6B7]/35 pt-4 sm:space-y-4">
              {page.bullets.map((bullet) => (
                <div key={bullet} className="flex gap-3 rounded-xl bg-[#FFF7F2] p-3 sm:rounded-2xl sm:p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#8D294D]" />
                  <p className="text-sm font-semibold leading-6 text-[#5B2035] sm:text-base">{bullet}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {key === "pricing" ? (
        <LaunchPricingSection compact />
      ) : (
        <section className="border-y border-[#E6A6B7]/30 bg-white/55 px-4 py-12 sm:px-5 sm:py-14">
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#B16C8E]">Why couples trust it</p>
              <h2 className="mt-3 font-serif text-3xl leading-tight text-[#8D294D] sm:text-4xl">
                One workspace for the plan, the guests, and the details.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6F3E54] sm:text-base">
                A.I DO keeps the moving parts connected so couples can start with the essentials and add deeper tools only when they need them.
              </p>
            </div>
            <Button asChild className="h-12 rounded-full bg-[#8D294D] px-7 text-white hover:bg-[#6F1D3D]">
              <Link href={signupHref(`${key}_trust_section`)} onClick={() => trackStartPlanning("trust_section")}>Start Planning</Link>
            </Button>
          </div>
        </section>
      )}

      <footer className="border-t border-[#E6A6B7]/35 px-5 py-8 text-center text-sm text-[#6F3E54]">
        <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-4">
          <Link href="/privacy" className="hover:text-[#8D294D]">Privacy</Link>
          <Link href="/terms" className="hover:text-[#8D294D]">Terms</Link>
          <Link href="/security" className="hover:text-[#8D294D]">Security</Link>
          <Link href="/for-vendors" className="hover:text-[#8D294D]">Vendor partners</Link>
        </div>
      </footer>
    </main>
  );
}
