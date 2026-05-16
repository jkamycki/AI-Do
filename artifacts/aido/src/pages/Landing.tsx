import { useEffect } from "react";
import { apiFetch } from "@/lib/authFetch";
import { Link } from "wouter";
import { Calendar, CheckSquare, ChevronDown, Heart, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguagePicker } from "@/components/LanguagePicker";
import i18n, { LANG_NAME_TO_CODE } from "@/i18n";

const LANG_CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(LANG_NAME_TO_CODE).map(([name, code]) => [code, name])
);

const HERO_FEATURES = [
  { icon: Calendar, label: "Smart Planning" },
  { icon: Mail, label: "Vendor Emails" },
  { icon: CheckSquare, label: "Timeline Builder" },
  { icon: Heart, label: "Stress Free" },
];

const SPARKLES = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  left: `${8 + ((i * 17) % 86)}%`,
  top: `${14 + ((i * 23) % 72)}%`,
  delay: `${(i % 6) * 0.45}s`,
}));

function LandingLanguagePicker() {
  const currentName = LANG_CODE_TO_NAME[i18n.language] ?? "English";

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
        className="h-11 px-0 text-[#B16C8E] hover:bg-transparent hover:text-[#8D294D] [&>span]:hidden [&>svg]:h-7 [&>svg]:w-7"
      />
      <ChevronDown className="pointer-events-none -ml-1 h-5 w-5 text-[#B16C8E]" />
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
    <div className="min-h-screen bg-[#FFF7F2] text-[#8D294D]">
      <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b border-[#E6A6B7]/70 bg-[#FFF7F2]/[0.92] px-5 shadow-[0_1px_0_rgba(141,41,77,0.06)] backdrop-blur-md sm:h-[106px] sm:px-12">
        <LandingLanguagePicker />
        <nav className="flex items-center gap-3 sm:gap-10">
          <Link href="/sign-in">
            <Button variant="ghost" className="h-10 px-1 text-base font-medium text-[#8D294D] hover:bg-transparent hover:text-[#B16C8E] sm:h-12 sm:px-2 sm:text-2xl">
              Sign In
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button className="h-12 rounded-full bg-[linear-gradient(110deg,#E6A6B7_0%,#F2CFC6_52%,#E9A6A0_100%)] px-5 text-base font-semibold text-[#8D294D] shadow-[0_14px_24px_rgba(141,41,77,0.2)] hover:opacity-95 sm:h-16 sm:px-11 sm:text-2xl">
              Get Started Free
            </Button>
          </Link>
        </nav>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-[#F2E2C6] bg-[#FFF7F2]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(255,255,255,0.98)_0%,rgba(255,247,242,0.9)_38%,rgba(242,226,198,0.38)_100%)]" />
          <div className="absolute inset-x-0 top-0 h-[520px] bg-[url('/images/floral-bg.png')] bg-cover bg-center opacity-[0.32] mix-blend-multiply" />
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#8D294D,#E6A6B7,#F2E2C6,#B16C8E)]" />
          <HeroSparkles />
          <div className="relative z-10 mx-auto flex min-h-[calc(100vh-210px)] max-w-5xl flex-col items-center px-5 pb-6 pt-6 text-center sm:min-h-[calc(100vh-250px)] sm:px-8 sm:pb-10 sm:pt-10">
            <img
              src="/logo.png"
              alt="A.I Do - AI Wedding Planner Assistant"
              className="h-28 w-auto object-contain drop-shadow-[0_22px_38px_rgba(141,41,77,0.16)] sm:h-40"
            />
            <div className="mt-3 rounded-full border border-[#B16C8E] bg-white/[0.55] px-6 py-1.5 text-base font-bold uppercase tracking-[0.18em] text-[#B16C8E] shadow-sm sm:text-lg">
              Beta
            </div>

            <div className="mt-4 inline-flex items-center gap-3 rounded-full bg-[#F2E2C6]/[0.55] px-5 py-3 text-base font-medium text-[#B16C8E] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_12px_28px_rgba(141,41,77,0.08)] sm:mt-5 sm:px-10 sm:text-xl">
              <Sparkles className="h-5 w-5 text-[#E6A6B7]" />
              <span>AI Wedding Planner Assistant</span>
            </div>

            <h1 className="mt-5 max-w-4xl font-serif text-[2.65rem] leading-[0.98] tracking-normal text-[#8D294D] sm:mt-6 sm:text-[4rem] md:text-[4.8rem]">
              Plan your perfect day,
              <br />
              <span className="italic text-[#C39B70]">effortlessly.</span>
            </h1>
            <div className="mt-4 flex items-center gap-2 text-[#C39B70]" aria-hidden="true">
              <span className="h-px w-20 bg-[linear-gradient(90deg,transparent,#C39B70)]" />
              <Heart className="h-4 w-4 fill-[#E6A6B7] text-[#E6A6B7]" />
              <span className="h-px w-20 bg-[linear-gradient(90deg,#C39B70,transparent)]" />
            </div>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[#6F3E54] sm:mt-4 sm:text-xl sm:leading-8">
              A.I Do is your AI wedding planning partner - from setting a budget and building a timeline to drafting vendor emails and coordinating the big day itself.
            </p>

            <div className="mt-5 flex w-full max-w-2xl flex-col gap-4 sm:mt-6">
              <Link href="/sign-up">
                <Button className="h-14 w-full rounded-full bg-[linear-gradient(110deg,#E6A6B7_0%,#D88A96_42%,#F4C9C2_100%)] text-lg font-semibold text-white shadow-[0_20px_36px_rgba(141,41,77,0.22)] hover:opacity-95 sm:h-16 sm:text-xl">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Start Planning Free
                  <Sparkles className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative z-10 border-t border-[#E6A6B7]/30 bg-white/[0.45] px-4 py-8 backdrop-blur-sm">
            <div className="mx-auto grid max-w-4xl grid-cols-2 gap-y-7 sm:grid-cols-4">
              {HERO_FEATURES.map(({ icon: Icon, label }, index) => (
                <div key={label} className="flex min-h-24 flex-col items-center justify-center gap-3 border-[#E6A6B7]/40 text-[#8D294D] sm:border-l sm:first:border-l-0">
                  <Icon className="h-11 w-11 stroke-[1.4] text-[#C85F82]" />
                  <span className="text-sm font-medium sm:text-base">{label}</span>
                  {index === 1 && <span className="sr-only">Vendor email drafting</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[linear-gradient(180deg,#FFF7F2_0%,#F9ECE8_100%)] px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 text-center">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#B16C8E]">Feature Preview</p>
              <h2 className="mt-3 font-serif text-4xl text-[#8D294D] sm:text-5xl">See A.I Do in motion</h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[#6F3E54]">
                Watch how A.I Do keeps your budget, timeline, guests, vendor notes, and planning conversations moving together.
              </p>
            </div>
            <div className="relative overflow-hidden rounded-[32px] border border-[#E6A6B7]/55 bg-white/[0.72] p-3 shadow-[0_28px_80px_rgba(141,41,77,0.18)]">
              <div className="relative aspect-[9/16] overflow-hidden rounded-[24px] bg-[#FFF7F2] sm:aspect-video">
                <iframe
                  src="/promo"
                  title="A.IDO feature preview"
                  className="absolute inset-0 h-full w-full border-0"
                  allow="autoplay"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E6A6B7]/35 bg-[#FFF7F2] px-8 py-8 text-center text-sm text-[#8D294D]/70">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
          <img src="/logo.png" alt="A.I Do" className="h-20 w-auto object-contain" />
          <p>A.IDO - AI Wedding Planner Assistant</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
            <span>&copy; {new Date().getFullYear()} A.IDO. All rights reserved.</span>
            <Link href="/terms" className="underline-offset-4 hover:underline">Terms of Service</Link>
            <Link href="/privacy" className="underline-offset-4 hover:underline">Privacy Policy</Link>
            <Link href="/beta" className="underline-offset-4 hover:underline">Beta Disclaimer</Link>
            <Link href="/security" className="underline-offset-4 hover:underline">Security</Link>
            <Link href="/data-handling" className="underline-offset-4 hover:underline">Data Handling</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
