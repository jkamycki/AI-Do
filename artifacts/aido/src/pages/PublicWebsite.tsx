import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { apiFetch } from "@/lib/authFetch";
import { Loader2, Heart, MapPin, Calendar, Clock, Gift, HelpCircle, Image as ImageIcon, Lock } from "lucide-react";

// ---- types ----

interface PublicSitePayload {
  slug: string;
  theme: string;
  layoutStyle: string;
  font: string;
  accentColor: string;
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    neutral: string;
    background: string;
    text: string;
  };
  sectionsEnabled: {
    welcome: boolean;
    story: boolean;
    schedule: boolean;
    travel: boolean;
    registry: boolean;
    faq: boolean;
    gallery: boolean;
    weddingParty: boolean;
  };
  customText: Record<string, string>;
  galleryImages: Array<{ url: string; caption?: string; order: number }>;
  heroImage: string | null;
  couple: {
    partner1Name: string;
    partner2Name: string;
    weddingDate: string;
    ceremonyTime: string;
    receptionTime: string;
    venue: string;
    location: string;
    venueCity: string | null;
    venueState: string | null;
  };
  timeline: Array<{ time: string; title: string; description: string; category: string }>;
}

// ---- helpers ----

function formatWeddingDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fontStack(font: string): string {
  return `'${font}', 'Playfair Display', Georgia, serif`;
}

// ---- password gate ----

function PasswordGate({ accent, font, onSubmit, error }: { accent: string; font: string; onSubmit: (pw: string) => void; error: string | null }) {
  const [pw, setPw] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FAF8F4" }}>
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6" style={{ background: `${accent}15` }}>
          <Lock className="h-7 w-7" style={{ color: accent }} />
        </div>
        <h1 className="text-3xl mb-3" style={{ fontFamily: fontStack(font), color: "#222" }}>
          Private Wedding
        </h1>
        <p className="text-sm text-gray-600 mb-8">
          This wedding site is password protected. Please enter the password the couple shared with you.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pw.trim()) onSubmit(pw.trim());
          }}
          className="flex flex-col gap-3"
        >
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 text-base"
            style={{ outlineColor: accent }}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full px-4 py-3 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
            style={{ background: accent }}
          >
            View Site
          </button>
        </form>
      </div>
    </div>
  );
}

// ---- sections ----

function Hero({ data }: { data: PublicSitePayload }) {
  const couple = `${data.couple.partner1Name} & ${data.couple.partner2Name}`;
  const dateStr = formatWeddingDate(data.couple.weddingDate);
  return (
    <section
      className="relative min-h-[80vh] flex items-center justify-center text-center px-6 py-24"
      style={{
        background: data.heroImage
          ? `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.55)), url(${data.heroImage}) center/cover no-repeat`
          : `linear-gradient(135deg, ${data.colorPalette.primary}22, ${data.colorPalette.secondary}22)`,
        color: data.heroImage ? "#fff" : data.colorPalette.text,
      }}
    >
      <div className="max-w-3xl">
        <p
          className="uppercase tracking-[0.3em] text-xs sm:text-sm mb-6 opacity-80"
          style={{ color: data.heroImage ? "#fff" : data.colorPalette.primary }}
        >
          We're getting married
        </p>
        <h1
          className="text-5xl sm:text-7xl md:text-8xl mb-6 leading-tight"
          style={{ fontFamily: fontStack(data.font) }}
        >
          {couple}
        </h1>
        <div className="flex items-center justify-center gap-4 text-base sm:text-lg opacity-90">
          <Calendar className="h-5 w-5" />
          <span>{dateStr}</span>
        </div>
        {data.couple.venue && (
          <div className="flex items-center justify-center gap-2 mt-3 text-sm sm:text-base opacity-80">
            <MapPin className="h-4 w-4" />
            <span>
              {data.couple.venue}
              {data.couple.venueCity && `, ${data.couple.venueCity}`}
              {data.couple.venueState && `, ${data.couple.venueState}`}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function SectionShell({
  id,
  title,
  icon,
  children,
  data,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  data: PublicSitePayload;
}) {
  return (
    <section id={id} className="py-20 px-6" style={{ background: id === "gallery" ? data.colorPalette.neutral : data.colorPalette.background }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-3" style={{ color: data.colorPalette.primary }}>
          {icon}
          <span className="uppercase tracking-[0.25em] text-xs">{title}</span>
        </div>
        <div className="w-12 h-px mx-auto mb-12" style={{ background: data.colorPalette.primary }} />
        {children}
      </div>
    </section>
  );
}

function Welcome({ data }: { data: PublicSitePayload }) {
  const text = data.customText.welcome ?? "";
  if (!text) return null;
  return (
    <SectionShell id="welcome" title="Welcome" icon={<Heart className="h-4 w-4" />} data={data}>
      <p className="text-center text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: data.colorPalette.text }}>
        {text}
      </p>
    </SectionShell>
  );
}

function Story({ data }: { data: PublicSitePayload }) {
  const text = data.customText.story ?? "";
  if (!text) return null;
  return (
    <SectionShell id="story" title="Our Story" icon={<Heart className="h-4 w-4" />} data={data}>
      <h2 className="text-center text-3xl sm:text-4xl mb-8" style={{ fontFamily: fontStack(data.font), color: data.colorPalette.text }}>
        How we got here
      </h2>
      <p className="text-center text-base sm:text-lg leading-relaxed max-w-2xl mx-auto whitespace-pre-line" style={{ color: data.colorPalette.text }}>
        {text}
      </p>
    </SectionShell>
  );
}

function Schedule({ data }: { data: PublicSitePayload }) {
  const events = data.timeline ?? [];
  const hasFallback = data.couple.ceremonyTime || data.couple.receptionTime;
  if (events.length === 0 && !hasFallback) return null;
  return (
    <SectionShell id="schedule" title="Schedule" icon={<Clock className="h-4 w-4" />} data={data}>
      <h2 className="text-center text-3xl sm:text-4xl mb-10" style={{ fontFamily: fontStack(data.font), color: data.colorPalette.text }}>
        The day of
      </h2>
      <div className="space-y-5 max-w-2xl mx-auto">
        {events.length > 0 ? (
          events.map((e, i) => (
            <div key={i} className="flex gap-4 items-start py-3 border-b last:border-b-0" style={{ borderColor: `${data.colorPalette.primary}22` }}>
              <div className="flex-shrink-0 w-24 sm:w-32 text-sm sm:text-base font-medium" style={{ color: data.colorPalette.primary }}>
                {e.time}
              </div>
              <div className="flex-1">
                <div className="text-base sm:text-lg font-medium" style={{ color: data.colorPalette.text }}>
                  {e.title}
                </div>
                {e.description && (
                  <p className="text-sm mt-1 opacity-75" style={{ color: data.colorPalette.text }}>
                    {e.description}
                  </p>
                )}
              </div>
            </div>
          ))
        ) : (
          <>
            {data.couple.ceremonyTime && (
              <div className="flex gap-4 items-start py-3 border-b" style={{ borderColor: `${data.colorPalette.primary}22` }}>
                <div className="w-24 sm:w-32 text-sm sm:text-base font-medium" style={{ color: data.colorPalette.primary }}>
                  {data.couple.ceremonyTime}
                </div>
                <div className="flex-1 text-base sm:text-lg" style={{ color: data.colorPalette.text }}>
                  Ceremony
                </div>
              </div>
            )}
            {data.couple.receptionTime && (
              <div className="flex gap-4 items-start py-3">
                <div className="w-24 sm:w-32 text-sm sm:text-base font-medium" style={{ color: data.colorPalette.primary }}>
                  {data.couple.receptionTime}
                </div>
                <div className="flex-1 text-base sm:text-lg" style={{ color: data.colorPalette.text }}>
                  Reception
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </SectionShell>
  );
}

function Travel({ data }: { data: PublicSitePayload }) {
  const text = data.customText.travel ?? "";
  if (!text && !data.couple.venue) return null;
  return (
    <SectionShell id="travel" title="Travel & Venue" icon={<MapPin className="h-4 w-4" />} data={data}>
      <h2 className="text-center text-3xl sm:text-4xl mb-8" style={{ fontFamily: fontStack(data.font), color: data.colorPalette.text }}>
        Where & how to get there
      </h2>
      {data.couple.venue && (
        <div className="text-center mb-6">
          <div className="text-xl mb-1" style={{ color: data.colorPalette.text }}>{data.couple.venue}</div>
          {data.couple.location && (
            <div className="text-sm opacity-75" style={{ color: data.colorPalette.text }}>
              {data.couple.location}
            </div>
          )}
        </div>
      )}
      {text && (
        <p className="text-center text-base sm:text-lg leading-relaxed max-w-2xl mx-auto whitespace-pre-line" style={{ color: data.colorPalette.text }}>
          {text}
        </p>
      )}
    </SectionShell>
  );
}

function Registry({ data }: { data: PublicSitePayload }) {
  const text = data.customText.registry ?? "";
  if (!text) return null;
  return (
    <SectionShell id="registry" title="Registry" icon={<Gift className="h-4 w-4" />} data={data}>
      <h2 className="text-center text-3xl sm:text-4xl mb-8" style={{ fontFamily: fontStack(data.font), color: data.colorPalette.text }}>
        With love
      </h2>
      <p className="text-center text-base sm:text-lg leading-relaxed max-w-2xl mx-auto whitespace-pre-line" style={{ color: data.colorPalette.text }}>
        {text}
      </p>
    </SectionShell>
  );
}

function Faq({ data }: { data: PublicSitePayload }) {
  const text = data.customText.faq ?? "";
  if (!text) return null;
  return (
    <SectionShell id="faq" title="FAQ" icon={<HelpCircle className="h-4 w-4" />} data={data}>
      <h2 className="text-center text-3xl sm:text-4xl mb-8" style={{ fontFamily: fontStack(data.font), color: data.colorPalette.text }}>
        Good to know
      </h2>
      <p className="text-center text-base sm:text-lg leading-relaxed max-w-2xl mx-auto whitespace-pre-line" style={{ color: data.colorPalette.text }}>
        {text}
      </p>
    </SectionShell>
  );
}

function Gallery({ data }: { data: PublicSitePayload }) {
  const images = (data.galleryImages ?? []).slice().sort((a, b) => a.order - b.order);
  if (images.length === 0) return null;
  return (
    <SectionShell id="gallery" title="Gallery" icon={<ImageIcon className="h-4 w-4" />} data={data}>
      <h2 className="text-center text-3xl sm:text-4xl mb-10" style={{ fontFamily: fontStack(data.font), color: data.colorPalette.text }}>
        Moments
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((img, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-lg group">
            <img
              src={img.url.startsWith("/objects/") ? `/api/storage${img.url}` : img.url}
              alt={img.caption ?? ""}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            {img.caption && (
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                {img.caption}
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function Footer({ data }: { data: PublicSitePayload }) {
  const couple = `${data.couple.partner1Name} & ${data.couple.partner2Name}`;
  return (
    <footer className="py-12 px-6 text-center" style={{ background: data.colorPalette.primary, color: "#fff" }}>
      <div className="text-2xl mb-2" style={{ fontFamily: fontStack(data.font) }}>{couple}</div>
      <div className="text-sm opacity-80">{formatWeddingDate(data.couple.weddingDate)}</div>
    </footer>
  );
}

// ---- main page ----

export default function PublicWebsite() {
  const [, params] = useRoute("/w/:slug");
  const slug = params?.slug ?? "";

  const [password, setPassword] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(`aido_w_pw_${slug}`);
    } catch {
      return null;
    }
  });
  const [data, setData] = useState<PublicSitePayload | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    const url = password
      ? `/api/website/public/${encodeURIComponent(slug)}?password=${encodeURIComponent(password)}`
      : `/api/website/public/${encodeURIComponent(slug)}`;
    apiFetch(url)
      .then(async (res) => {
        if (res.status === 401) {
          const body = await res.json().catch(() => ({}));
          if (body?.passwordRequired) {
            setNeedsPassword(true);
            setData(null);
            if (password) setPwError("Incorrect password. Please try again.");
            return;
          }
        }
        if (res.status === 404) {
          setError("This wedding website doesn't exist or hasn't been published yet.");
          return;
        }
        if (!res.ok) {
          setError("Failed to load this site. Please try again later.");
          return;
        }
        const body = (await res.json()) as PublicSitePayload;
        setData(body);
        setNeedsPassword(false);
        setPwError(null);
      })
      .catch(() => setError("Failed to load this site. Please try again later."))
      .finally(() => setLoading(false));
  }, [slug, password]);

  // Inject font preconnect once (Google Fonts) when font is set
  useEffect(() => {
    if (!data?.font) return;
    const id = "aido-public-website-font";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    const fontName = encodeURIComponent(data.font).replace(/%20/g, "+");
    link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;600;700&display=swap`;
  }, [data?.font]);

  // Page title
  useEffect(() => {
    if (data) {
      document.title = `${data.couple.partner1Name} & ${data.couple.partner2Name} — Wedding`;
    } else {
      document.title = "Wedding Website";
    }
  }, [data]);

  const acceptedSections = useMemo(() => data?.sectionsEnabled ?? null, [data]);

  if (loading && !data && !needsPassword && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAF8F4" }}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (needsPassword) {
    return (
      <PasswordGate
        accent="#D4A017"
        font="Playfair Display"
        error={pwError}
        onSubmit={(pw) => {
          try {
            sessionStorage.setItem(`aido_w_pw_${slug}`, pw);
          } catch {
            // ignore sessionStorage failures
          }
          setPassword(pw);
        }}
      />
    );
  }

  if (error || !data || !acceptedSections) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center" style={{ background: "#FAF8F4" }}>
        <div>
          <h1 className="text-2xl mb-2 text-gray-800" style={{ fontFamily: fontStack("Playfair Display") }}>Page not found</h1>
          <p className="text-sm text-gray-600">{error ?? "This wedding website is not available."}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: data.colorPalette.background, color: data.colorPalette.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Hero data={data} />
      {acceptedSections.welcome && <Welcome data={data} />}
      {acceptedSections.story && <Story data={data} />}
      {acceptedSections.schedule && <Schedule data={data} />}
      {acceptedSections.travel && <Travel data={data} />}
      {acceptedSections.registry && <Registry data={data} />}
      {acceptedSections.faq && <Faq data={data} />}
      {acceptedSections.gallery && <Gallery data={data} />}
      <Footer data={data} />
    </div>
  );
}
