import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { organizationSchema, setSeo, softwareSchema } from "@/lib/seo";

const INCLUDED = [
  "Simple wedding profile setup",
  "Wedding website and RSVP basics",
  "Guest list, checklist, budget, and vendor tools",
  "Mobile-friendly planning from your phone",
  "More advanced tools only when you are ready",
];

const FIRST_STEPS = [
  "Add your wedding date, location, and guest estimate",
  "Choose your first priority: website, RSVPs, guests, budget, or vendors",
  "Continue from the dashboard with one recommended next action",
];

export default function EarlyAccess() {
  useEffect(() => {
    setSeo({
      title: "Start Planning | A.I DO Wedding Planner",
      description: "Start planning with A.I DO, a simple AI wedding planner with wedding website, RSVPs, guests, checklist, budget, vendors, and mobile-friendly planning.",
      path: "/early-access",
      jsonLd: [
        organizationSchema(),
        softwareSchema(
          "A.I DO Wedding Planner",
          "Start planning with A.I DO to plan a wedding website, RSVPs, guests, budget, vendors, and day-of details.",
          "/early-access",
        ),
      ],
    });
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#FFF7F2] text-[#5B2035]">
      <header className="border-b border-[#E6A6B7]/45 bg-[#FFF7F2]/95 px-4 py-3 backdrop-blur sm:px-5 sm:py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <img src="/logo-optimized.jpg" alt="A.I DO" className="h-11 w-auto shrink-0 sm:h-14" decoding="async" />
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-semibold text-[#6F3E54] md:flex">
            <Link href="/ai-wedding-planner" className="hover:text-[#8D294D]">AI Planner</Link>
            <Link href="/wedding-website-builder" className="hover:text-[#8D294D]">Website Builder</Link>
            <Link href="/for-vendors" className="hover:text-[#8D294D]">Partner With Us</Link>
          </nav>
          <Button asChild className="h-10 shrink-0 rounded-full bg-[#8D294D] px-4 text-sm text-white hover:bg-[#6F1D3D] sm:px-5">
            <Link href="/sign-up">Start Planning</Link>
          </Button>
        </div>
      </header>

      <section className="relative isolate border-b border-[#E6A6B7]/30 px-4 py-14 sm:px-6 sm:py-20">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#8D294D,#E6A6B7,#F2E2C6,#B16C8E)]" />
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#E6A6B7]/60 bg-white/65 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#B16C8E]">
              <Heart className="h-4 w-4 fill-[#E6A6B7] text-[#E6A6B7]" />
              Start planning
            </div>
            <h1 className="mt-6 max-w-3xl text-balance font-serif text-[2.8rem] leading-[1.02] text-[#8D294D] sm:text-6xl">
              Start your wedding plan with A.I DO.
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-[#6F3E54] sm:text-xl sm:leading-8">
              Create one calm workspace for your wedding website, RSVPs, guest list, checklist, budget, vendors, and mobile-friendly planning.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-12 w-full rounded-full bg-[#8D294D] px-6 text-white hover:bg-[#6F1D3D] sm:w-auto">
                <Link href="/sign-up">
                  Start Planning
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-sm font-semibold text-[#6F3E54]">
              No credit card required to start.
            </p>
            <div className="mt-5 rounded-[28px] border border-[#E6A6B7]/35 bg-white/65 p-4 shadow-[0_12px_30px_rgba(141,41,77,0.08)]">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#B16C8E]">What happens first</p>
              <div className="mt-3 grid gap-2">
                {FIRST_STEPS.map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded-2xl bg-[#FFF7F2] p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8D294D] text-xs font-bold text-white">{index + 1}</span>
                    <p className="text-sm font-semibold leading-5 text-[#5B2035]">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-[#E6A6B7]/45 bg-white/75 p-5 shadow-[0_28px_80px_rgba(141,41,77,0.14)] sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#B16C8E]">What you can do</p>
            <div className="mt-5 space-y-3">
              {INCLUDED.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-[#FFF7F2] p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#8D294D]" />
                  <p className="text-sm font-semibold leading-6 text-[#5B2035] sm:text-base">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
