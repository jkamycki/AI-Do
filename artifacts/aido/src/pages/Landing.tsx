import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Sparkles, Calendar, DollarSign, CheckSquare, Mail, FileText, Armchair, Link2, Bot, Star, Quote, Globe, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import i18n, { LANG_NAME_TO_CODE } from "@/i18n";
import { AnimatePresence, motion } from "framer-motion";

const HEADER_TAGLINES = [
  "Wedding planning, made easy.",
  "Your AI wedding planner — always on call.",
  "From timeline to seating chart, all in one place.",
  "Plan together. Stress less. Celebrate more.",
  "Smart vendors. Smart budget. Smart you.",
];

function RotatingTagline() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setIndex(i => (i + 1) % HEADER_TAGLINES.length);
    }, 8000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="relative h-12 flex items-center justify-start overflow-hidden w-full">
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          exit={{ clipPath: "inset(0 0 0 100%)" }}
          transition={{ duration: 2.2, ease: [0.65, 0, 0.35, 1] }}
          className="font-serif italic text-2xl sm:text-3xl md:text-4xl font-semibold tracking-wide whitespace-nowrap text-left"
          style={{
            background: "linear-gradient(135deg, #FFFFFF 0%, #F8E1F0 50%, #E91E8C 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {HEADER_TAGLINES[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Chinese (Simplified)", "Japanese", "Korean", "Arabic", "Hindi",
  "Russian", "Dutch", "Polish",
];

const LANG_CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(LANG_NAME_TO_CODE).map(([name, code]) => [code, name])
);

const featureIcons = [Calendar, DollarSign, CheckSquare, Mail, FileText, Sparkles, Armchair, Link2, Bot];

const testimonials = [
  {
    name: "Priya & Marcus",
    location: "Austin, TX",
    date: "Married June 2025",
    avatar: "PM",
    rating: 5,
    text: "A.IDO genuinely felt like having a wedding planner in my pocket 24/7. The AI timeline saved us hours of back-and-forth with our venue coordinator, and the vendor email drafts were so professional I got compliments on them. We stayed under budget for the first time in our family's wedding history!",
  },
  {
    name: "Camille & Jordan",
    location: "Charleston, SC",
    date: "Married September 2025",
    avatar: "CJ",
    rating: 5,
    text: "We were planning from two different cities and the collaboration features were a lifesaver. Aria answered my panicked 2am questions like a champ, and the day-of coordinator kept everything on track when our photographer was 45 minutes late. Absolute game changer.",
  },
  {
    name: "Diana & Alexei",
    location: "Portland, OR",
    date: "Married March 2026",
    avatar: "DA",
    rating: 5,
    text: "The contract analyzer caught a clause in our catering agreement that would have cost us an extra $2,000 for overtime. A.IDO literally paid for itself in the first week. I recommended it to every engaged person I know.",
  },
  {
    name: "Sofia & Kwame",
    location: "Atlanta, GA",
    date: "Married January 2026",
    avatar: "SK",
    rating: 5,
    text: "I was overwhelmed with 230 guests and no idea where to start. Within 10 minutes of signing up, I had a full vendor checklist, a draft budget, and my first vendor email sent. I cried happy tears. This app is everything.",
  },
];

function Stars({ count = 5 }: { count?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
}

function LandingLanguagePicker() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentName = LANG_CODE_TO_NAME[i18n.language] ?? "English";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(lang: string) {
    const code = LANG_NAME_TO_CODE[lang] ?? "en";
    i18n.changeLanguage(code);
    localStorage.setItem("aido_language", code);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-sm text-white/70 hover:text-primary transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{currentName}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-48 bg-card border border-primary/20 rounded-xl shadow-xl z-50 py-1 max-h-64 overflow-y-auto"
          style={{ maxWidth: "calc(100vw - 1rem)" }}
        >
          {LANGUAGES.map(lang => (
            <button
              key={lang}
              onClick={() => select(lang)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-primary/10 ${lang === currentName ? "text-primary font-medium" : "text-foreground"}`}
            >
              {lang}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Landing() {
  const { t } = useTranslation();

  const featureKeys = [
    "timeline", "budget", "checklist", "emails", "contracts", "profile", "seating", "collector", "assistant",
  ];

  const features = featureKeys.map((key, i) => ({
    icon: featureIcons[i],
    title: t(`features.${key}_title`),
    desc: t(`features.${key}_desc`),
  }));

  return (
    <div className="dark min-h-screen bg-background flex flex-col">
      <header
        className="px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between bg-background/80 backdrop-blur-md relative"
        style={{
          borderBottom: "4px solid transparent",
          borderImage: "linear-gradient(90deg, #B8860B 0%, #D4A017 35%, #F5C842 50%, #D4A017 65%, #B8860B 100%) 1",
        }}
      >
        <div className="flex-1 min-w-0 pr-2 sm:pr-6 hidden sm:block">
          <RotatingTagline />
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-end">
          <LandingLanguagePicker />
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/5 font-medium text-sm px-3">{t("landing.cta_signin")}</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="btn-gradient rounded-full px-4 sm:px-6 shadow-sm text-sm">
                {t("landing.get_started")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center">
        {/* Hero */}
        <section className="text-center px-4 sm:px-6 pt-8 sm:pt-16 pb-10 sm:pb-16 max-w-3xl mx-auto">
          <div className="flex flex-col items-center mb-6 sm:mb-8 gap-3">
            <img src="/logo.png" alt="A.I Do — AI Wedding Planner Assistant" className="h-48 sm:h-80 w-auto object-contain drop-shadow-xl" />
            <span
              className="text-[11px] font-bold tracking-[0.22em] uppercase px-3 py-1 rounded-full border border-primary/50 text-primary bg-primary/10"
              style={{ letterSpacing: "0.22em" }}
            >
              BETA
            </span>
          </div>
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-semibold px-4 py-2 rounded-full mb-6">
            <Sparkles className="h-4 w-4" />
            <span>{t("landing.badge")}</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl leading-tight mb-4 sm:mb-6">
            <span className="brand-gradient-text">{t("landing.hero_line1")}</span><br />
            <span className="gold-gradient-text italic">{t("landing.hero_line2")}</span>
          </h1>
          <p className="text-base sm:text-xl text-white/75 mb-7 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
            {t("landing.hero_desc")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" className="btn-gradient rounded-full px-8 sm:px-10 text-base sm:text-lg h-12 sm:h-14 shadow-lg w-full sm:w-auto">
                {t("landing.cta_start")}
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="border-primary/30 text-primary hover:bg-primary/5 rounded-full px-8 sm:px-10 text-base sm:text-lg h-12 sm:h-14 w-full sm:w-auto">
                {t("landing.cta_signin")}
              </Button>
            </Link>
          </div>
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-white/65">
            <div className="flex -space-x-2">
              {["PM","CJ","DA","SK"].map(initials => (
                <div key={initials} className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-[10px] font-bold text-primary">
                  {initials}
                </div>
              ))}
            </div>
            <Stars count={5} />
            <span className="font-medium text-foreground">5.0</span>
          </div>
        </section>

        {/* Promo Video */}
        <section className="w-full max-w-7xl px-4 sm:px-6 pb-10 sm:pb-20">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="font-serif text-2xl sm:text-3xl text-primary mb-3">{t("landing.video_title")}</h2>
            <p className="text-white/65">{t("landing.video_desc")}</p>
          </div>
          <div className="relative w-full overflow-hidden rounded-2xl shadow-2xl border border-primary/10" style={{ aspectRatio: "16/9" }}>
            <iframe
              src="/promo"
              title="A.IDO Feature Preview"
              className="absolute inset-0 w-full h-full border-0"
              allow="autoplay"
            />
          </div>
        </section>

        {/* Features */}
        <section className="w-full max-w-5xl px-4 sm:px-6 pb-10 sm:pb-20">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="font-serif text-2xl sm:text-3xl text-primary mb-3">{t("landing.features_title")}</h2>
            <p className="text-white/65 text-lg">{t("landing.features_desc")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card rounded-2xl p-6 border border-primary/10 hover:border-primary/20 hover:shadow-md transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-serif text-lg text-primary mb-2">{title}</h3>
                <p className="text-white/65 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="brand-gradient-text font-serif text-lg font-semibold">
                {t("landing.features_more", "…and so much more")}
              </span>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="w-full bg-background border-t border-b border-primary/10 py-12 sm:py-20 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8 sm:mb-14">
              <div className="inline-flex items-center gap-2 bg-amber-900/40 text-amber-300 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{t("landing.testimonials_badge")}</span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-primary mb-3">{t("landing.testimonials_title")}</h2>
              <div className="flex items-center justify-center gap-2 text-white/65">
                <Stars />
                <span className="font-semibold text-foreground text-lg">5.0</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {testimonials.map((item) => (
                <div
                  key={item.name}
                  className="rounded-2xl p-6 bg-background shadow-lg hover:shadow-xl transition-shadow flex flex-col gap-4"
                  style={{
                    border: "2px solid",
                    borderImage: "linear-gradient(135deg, #B8860B 0%, #D4A017 50%, #F5C842 100%) 1",
                  }}
                >
                  <Quote className="h-8 w-8 text-primary/20 fill-primary/10 -mb-1" />
                  <p className="text-sm leading-relaxed text-white/75 flex-1">"{item.text}"</p>
                  <Stars count={item.rating} />
                  <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {item.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <p className="text-xs text-white/50">{item.date} · {item.location}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full py-12 sm:py-20 px-4 sm:px-6 text-center">
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl text-primary mb-4">{t("landing.final_title")}</h2>
          <p className="text-white/70 mb-6 sm:mb-8 max-w-lg mx-auto text-base sm:text-lg">{t("landing.final_desc")}</p>
          <Link href="/sign-up">
            <Button size="lg" className="btn-gradient rounded-full px-10 sm:px-14 text-base sm:text-lg h-12 sm:h-14 shadow-lg">
              {t("landing.final_cta")}
            </Button>
          </Link>
          <p className="mt-4 text-xs text-white/50">{t("landing.no_cc")}</p>
        </section>
      </main>

      <footer className="px-8 py-8 border-t border-primary/10 text-center text-sm text-white/60">
        <div className="flex items-center justify-center gap-2 mb-3">
          <img src="/logo.png" alt="A.I Do" className="h-20 w-auto object-contain" />
          <span className="brand-gradient-text font-semibold">{t("landing.footer_brand")}</span>
        </div>
        <div className="flex items-center justify-center gap-4 text-xs text-white/45">
          <span>© {new Date().getFullYear()} A.IDO. {t("landing.footer_rights")}</span>
          <span className="w-px h-3 bg-border inline-block" />
          <Link href="/terms" className="hover:text-primary transition-colors underline underline-offset-2">
            {t("landing.footer_terms")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
