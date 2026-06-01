import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Camera, CheckCircle2, CheckSquare, Globe2, HeartHandshake, MailCheck, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LaunchPricingSection } from "@/components/LaunchPricingSection";
import { organizationSchema, setSeo, softwareSchema } from "@/lib/seo";

type PageKey =
  | "ai-wedding-planner"
  | "wedding-website-builder"
  | "wedding-photo-qr-code"
  | "wedding-planning-checklist"
  | "wedding-vendor-management"
  | "digital-invitations"
  | "wedding-guest-list-manager"
  | "wedding-budget-planner"
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
  sections: Array<{ heading: string; body: string }>;
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
    sections: [
      { heading: "Built for high-intent planning moments", body: "When you need to send a vendor message, compare a contract, organize a seating chart, or find the next task, A.I DO keeps the work connected instead of scattered across notes and spreadsheets." },
      { heading: "A complete wedding planning dashboard", body: "Track payments, manage RSVPs, store documents, publish a wedding website, and coordinate the wedding day from a single planning hub." },
    ],
  },
  "wedding-website-builder": {
    title: "Wedding Website Builder",
    metaTitle: "Wedding Website Builder With RSVP & QR Codes | A.I DO",
    description: "Create a wedding website with RSVP tools, QR codes, guest photo drop, registry links, hotel details, schedules, and custom sections in A.I DO.",
    eyebrow: "Wedding website builder",
    h1: "Create a wedding website guests can actually use.",
    intro: "Build and publish a personalized wedding website with home, story, schedule, travel, registry, wedding party, gallery, FAQ, RSVP, and QR-code sharing tools.",
    icon: Globe2,
    bullets: ["Guest-friendly wedding website pages", "Website QR code and RSVP QR code generation", "Password protection, gallery controls, and photo drop"],
    sections: [
      { heading: "Designed for guests", body: "Give guests one easy place to find ceremony details, travel information, hotel blocks, registry links, FAQs, and RSVP options." },
      { heading: "Connected to your planning tools", body: "Your website works alongside your guest list, invitations, RSVP flow, registry, and wedding-day photo collection." },
    ],
  },
  "wedding-photo-qr-code": {
    title: "Wedding Photo QR Code",
    metaTitle: "Wedding Photo QR Code & Disposable Camera | A.I DO",
    description: "Collect guest photos with a wedding photo QR code, disposable camera mode, upload limits, approval controls, and a private gallery in A.I DO.",
    eyebrow: "Wedding photo QR code",
    h1: "Collect wedding guest photos with a QR code, no app required.",
    intro: "A.I DO Photo Drop lets guests scan a QR code, open a disposable-camera style experience, submit their roll, and send photos to the couple for review.",
    icon: Camera,
    bullets: ["QR code for guest photo uploads", "Disposable camera mode with per-guest limits", "Private approval queue before photos appear publicly"],
    sections: [
      { heading: "Easy for guests at the reception", body: "Print the QR code on signage, table cards, or programs so guests can add candid moments from their phones without downloading another app." },
      { heading: "Controlled for the couple", body: "Upload limits, private storage, approval status, and gallery display settings help keep the photo collection manageable." },
    ],
  },
  "wedding-planning-checklist": {
    title: "Wedding Planning Checklist",
    metaTitle: "Wedding Planning Checklist & Timeline Tool | A.I DO",
    description: "Use A.I DO to manage your wedding planning checklist, due dates, reminders, timeline, budget tasks, and day-of planning details.",
    eyebrow: "Wedding planning checklist",
    h1: "Stay on track with a wedding planning checklist that adapts to your day.",
    intro: "A.I DO turns wedding tasks into an organized checklist with progress, due dates, planning priorities, budget context, and timeline coordination.",
    icon: CheckSquare,
    bullets: ["Month-by-month wedding checklist", "Due dates, progress, and reminders", "Connected timeline, vendor, budget, and document tasks"],
    sections: [
      { heading: "Know what to do next", body: "Keep ceremony, reception, guests, vendors, budget, and documents from competing for attention by organizing the next step in one dashboard." },
      { heading: "Move from planning to execution", body: "Checklist items can support the day-of timeline, vendor handoffs, payment reminders, and document review so details do not fall through." },
    ],
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
    sections: [
      { heading: "Built for fewer follow-ups", body: "Guests can respond digitally while couples keep RSVP details connected to guest records, invitations, meals, and planning totals." },
      { heading: "One guest source of truth", body: "Use A.I DO to keep invitation status, RSVP answers, hotel notes, and guest counts in one place instead of scattered messages." },
    ],
  },
  "wedding-guest-list-manager": {
    title: "Wedding Guest List Manager",
    metaTitle: "Wedding Guest List Manager & RSVP Tracker | A.I DO",
    description: "Manage your wedding guest list, plus-ones, RSVP status, meal choices, groups, invitations, and guest communication in A.I DO.",
    eyebrow: "Wedding guest list manager",
    h1: "Organize your guest list before it turns into a spreadsheet maze.",
    intro: "A.I DO gives couples a cleaner way to manage guests, households, RSVP answers, meals, plus-ones, invitations, hotel notes, and final headcounts.",
    icon: Users,
    bullets: ["Guest groups, households, plus-ones, and RSVP status", "Meal choices, notes, and invitation tracking", "Connected website, invitations, seating, and photo tools"],
    sections: [
      { heading: "Made for real guest changes", body: "Track who is invited, confirmed, pending, declined, added late, or bringing a plus-one without losing the bigger planning picture." },
      { heading: "Connected to the wedding day", body: "Guest details can support RSVP totals, seating, hotel planning, photo drop access, and day-of coordination." },
    ],
  },
  "wedding-budget-planner": {
    title: "Wedding Budget Planner",
    metaTitle: "Wedding Budget Planner & Payment Tracker | A.I DO",
    description: "Track wedding budget categories, vendor payments, due dates, estimates, actual costs, and planning decisions in A.I DO.",
    eyebrow: "Wedding budget planner",
    h1: "Track wedding spending without guessing where the money went.",
    intro: "A.I DO helps couples organize budget categories, estimates, vendor costs, payment due dates, documents, and planning notes in one workspace.",
    icon: CheckCircle2,
    bullets: ["Budget categories, estimates, actuals, and due dates", "Vendor payments connected to contracts and notes", "Planning dashboard visibility for next money moves"],
    sections: [
      { heading: "Know what is paid and what is next", body: "Keep deposit dates, balances, vendor costs, and budget decisions visible so payment planning does not become a last-minute scramble." },
      { heading: "Budget with the rest of the plan", body: "Connect costs to vendors, documents, checklist items, and timeline decisions instead of managing budget in isolation." },
    ],
  },
  "wedding-vendor-management": {
    title: "Wedding Vendor Management",
    metaTitle: "Wedding Vendor Management Software | A.I DO",
    description: "Manage wedding vendors, contracts, messages, payments, contacts, budgets, and planning notes in one AI-assisted wedding workspace.",
    eyebrow: "Wedding vendor management",
    h1: "Manage wedding vendors, contracts, payments, and notes in one place.",
    intro: "A.I DO helps couples track vendor contacts, contracts, payment schedules, budget impact, messages, and day-of responsibilities from a single wedding planning workspace.",
    icon: HeartHandshake,
    bullets: ["Vendor contact and message tracking", "Contract analyzer and document library", "Budget and payment schedule visibility"],
    sections: [
      { heading: "Keep vendor decisions organized", body: "Compare details, store documents, track payments, and keep vendor conversations connected to the rest of the wedding plan." },
      { heading: "Reduce last-minute confusion", body: "A.I DO brings vendor notes into timelines, checklists, contracts, and day-of planning so handoffs stay clear." },
    ],
  },
  "pricing": {
    title: "A.I DO Pricing",
    metaTitle: "A.I DO Pricing | Wedding Planning App Plans",
    description: "Compare A.I DO wedding planning app pricing for founding couples, including early access planning tools, website builder, guest tools, vendor tracking, and AI planning help.",
    eyebrow: "Wedding planning app pricing",
    h1: "Start planning free during early access, then choose the plan that fits your wedding.",
    intro: "A.I DO is launching with simple couple-focused pricing: founding couples can start free, explore the workspace, and upgrade when paid launch features are ready.",
    icon: Sparkles,
    bullets: ["Free beta access for founding couples", "Simple monthly or annual paid plan when launch pricing is enabled", "Website, guest, vendor, budget, checklist, and AI planning tools"],
    sections: [
      { heading: "Built to lower the barrier", body: "Couples should be able to try the planning workspace before paying, then upgrade when they see enough value for their wedding." },
      { heading: "One wedding workspace", body: "Paid plans are designed to bundle the tools couples actually use: website, RSVPs, Photo Drop, vendors, budget, checklist, timeline, and AI planning support." },
    ],
  },
};

const relatedLinks = [
  { href: "/ai-wedding-planner", label: "AI wedding planner" },
  { href: "/wedding-website-builder", label: "Wedding website builder" },
  { href: "/wedding-photo-qr-code", label: "Wedding photo QR code" },
  { href: "/wedding-planning-checklist", label: "Wedding planning checklist" },
  { href: "/wedding-vendor-management", label: "Wedding vendor management" },
];

function pageKeyFromPath(path: string): PageKey {
  const normalized = path.replace(/^\/+|\/+$/g, "");
  const aliases: Record<string, PageKey> = {
    "photo-qr-code": "wedding-photo-qr-code",
    "wedding-vendor-manager": "wedding-vendor-management",
  };
  const key = (aliases[normalized] ?? normalized) as PageKey;
  return PAGE_CONTENT[key] ? key : "ai-wedding-planner";
}

export default function SeoMarketingPage() {
  const [location] = useLocation();
  const key = pageKeyFromPath(location);
  const page = PAGE_CONTENT[key];
  const Icon = page.icon;

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
            <Link href="/wedding-photo-qr-code" className="hover:text-[#8D294D]">Photo QR</Link>
            <Link href="/for-vendors" className="hover:text-[#8D294D]">Vendors</Link>
          </nav>
          <Button asChild className="h-10 shrink-0 rounded-full bg-[#8D294D] px-4 text-sm text-white hover:bg-[#6F1D3D] sm:px-5">
            <Link href="/early-access">Join Beta</Link>
          </Button>
        </div>
        <nav className="mx-auto mt-3 grid max-w-6xl grid-cols-5 gap-1.5 pb-1 text-center text-[11px] font-bold text-[#6F3E54] md:hidden" aria-label="Related wedding tools">
          <Link href="/" className="rounded-full border border-[#E6A6B7]/45 bg-white/70 px-1.5 py-2">Home</Link>
          <Link href="/wedding-website-builder" className="rounded-full border border-[#E6A6B7]/45 bg-white/70 px-1.5 py-2">Web</Link>
          <Link href="/wedding-photo-qr-code" className="rounded-full border border-[#E6A6B7]/45 bg-white/70 px-1.5 py-2">Photo</Link>
          <Link href="/wedding-planning-checklist" className="rounded-full border border-[#E6A6B7]/45 bg-white/70 px-1.5 py-2">List</Link>
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
                <Link href="/early-access">Join founding couples <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" className="h-12 w-full rounded-full border-[#B16C8E]/50 bg-white/55 px-6 text-[#8D294D] sm:w-auto">
                <Link href="/">See all features</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E6A6B7]/45 bg-white/75 p-4 shadow-[0_24px_70px_rgba(141,41,77,0.12)] sm:rounded-[2rem] sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#B16C8E] sm:text-sm sm:tracking-[0.22em]">What couples get</p>
            <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
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

      <section className="border-y border-[#E6A6B7]/30 bg-white/55 px-4 py-12 sm:px-5 sm:py-14">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2">
          {page.sections.map((section) => (
            <article key={section.heading} className="rounded-2xl border border-[#E6A6B7]/35 bg-[#FFFDFB] p-5 sm:rounded-[1.5rem] sm:p-6">
              <h2 className="font-serif text-2xl leading-tight text-[#8D294D] sm:text-3xl">{section.heading}</h2>
              <p className="mt-3 text-sm leading-7 text-[#6F3E54] sm:text-base">{section.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 py-12 sm:px-5 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-serif text-2xl leading-tight text-[#8D294D] sm:text-3xl">Explore related wedding planning tools</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {relatedLinks.filter((link) => link.href !== `/${key}`).map((link) => (
              <Link key={link.href} href={link.href} className="rounded-xl border border-[#E6A6B7]/35 bg-white/70 p-4 text-sm font-semibold text-[#6F3E54] hover:border-[#8D294D] hover:text-[#8D294D] sm:rounded-2xl sm:text-base">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <LaunchPricingSection compact />

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
