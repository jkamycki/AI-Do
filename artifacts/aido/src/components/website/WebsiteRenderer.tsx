import { useEffect, useState } from "react";
import { Calendar, MapPin, Heart, Clock, Gift, HelpCircle, Image as ImageIcon } from "lucide-react";

export interface WebsiteRendererPayload {
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

function imageUrl(url: string): string {
  if (url.startsWith("/objects/")) return `/api/storage${url}`;
  return url;
}

function Hero({ data }: { data: WebsiteRendererPayload }) {
  const couple = `${data.couple.partner1Name} & ${data.couple.partner2Name}`;
  const dateStr = formatWeddingDate(data.couple.weddingDate);
  return (
    <section
      id="home"
      className="relative min-h-[80vh] flex items-center justify-center text-center px-6 py-24"
      style={{
        background: data.heroImage
          ? `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.55)), url('${imageUrl(data.heroImage)}') center/cover no-repeat`
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
        <h1 className="text-5xl sm:text-7xl md:text-8xl mb-6 leading-tight" style={{ fontFamily: fontStack(data.font) }}>
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
  data: WebsiteRendererPayload;
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

function Welcome({ data }: { data: WebsiteRendererPayload }) {
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

function Story({ data }: { data: WebsiteRendererPayload }) {
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

function Schedule({ data }: { data: WebsiteRendererPayload }) {
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

function Travel({ data }: { data: WebsiteRendererPayload }) {
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

function Registry({ data }: { data: WebsiteRendererPayload }) {
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

function Faq({ data }: { data: WebsiteRendererPayload }) {
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

function Gallery({ data }: { data: WebsiteRendererPayload }) {
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
              src={imageUrl(img.url)}
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

function Footer({ data }: { data: WebsiteRendererPayload }) {
  const couple = `${data.couple.partner1Name} & ${data.couple.partner2Name}`;
  return (
    <footer className="py-12 px-6 text-center" style={{ background: data.colorPalette.primary, color: "#fff" }}>
      <div className="text-2xl mb-2" style={{ fontFamily: fontStack(data.font) }}>{couple}</div>
      <div className="text-sm opacity-80">{formatWeddingDate(data.couple.weddingDate)}</div>
    </footer>
  );
}

function TopNav({ data, scrollContainer }: { data: WebsiteRendererPayload; scrollContainer?: HTMLElement | null }) {
  const couple = `${data.couple.partner1Name} & ${data.couple.partner2Name}`;
  const [active, setActive] = useState<string>("home");

  // Build the ordered list of nav items only for sections that are enabled.
  const items: Array<{ id: string; label: string }> = [{ id: "home", label: "Home" }];
  if (data.sectionsEnabled.story) items.push({ id: "story", label: "Our Story" });
  if (data.sectionsEnabled.schedule) items.push({ id: "schedule", label: "Schedule" });
  if (data.sectionsEnabled.travel) items.push({ id: "travel", label: "Travel" });
  if (data.sectionsEnabled.registry) items.push({ id: "registry", label: "Registry" });
  if (data.sectionsEnabled.gallery) items.push({ id: "gallery", label: "Gallery" });
  if (data.sectionsEnabled.faq) items.push({ id: "faq", label: "FAQ" });

  // Track which section is currently in view to underline the right nav item.
  useEffect(() => {
    const root = scrollContainer ?? null;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry that's most visible.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { root, rootMargin: "-30% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    items.forEach((it) => {
      const el = document.getElementById(it.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.sectionsEnabled, scrollContainer]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  return (
    <nav
      className="sticky top-0 z-30 backdrop-blur-md border-b"
      style={{
        background: `${data.colorPalette.background}ee`,
        borderColor: `${data.colorPalette.primary}22`,
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex flex-col items-center gap-2">
        <button
          onClick={() => scrollTo("home")}
          className="text-2xl sm:text-3xl leading-tight transition-colors hover:opacity-80"
          style={{ fontFamily: fontStack(data.font), color: data.colorPalette.primary }}
        >
          {couple}
        </button>
        <div className="flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-7 gap-y-1 text-xs sm:text-sm">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => scrollTo(it.id)}
              className={`relative pb-1 transition-colors hover:opacity-80 ${active === it.id ? "" : "opacity-70"}`}
              style={{
                color: data.colorPalette.text,
                borderBottom: active === it.id ? `2px solid ${data.colorPalette.primary}` : "2px solid transparent",
                fontFamily: fontStack(data.font),
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

export function WebsiteRenderer({ data, scrollContainer }: { data: WebsiteRendererPayload; scrollContainer?: HTMLElement | null }) {
  return (
    <div style={{ background: data.colorPalette.background, color: data.colorPalette.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <TopNav data={data} scrollContainer={scrollContainer} />
      <Hero data={data} />
      {data.sectionsEnabled.welcome && <Welcome data={data} />}
      {data.sectionsEnabled.story && <Story data={data} />}
      {data.sectionsEnabled.schedule && <Schedule data={data} />}
      {data.sectionsEnabled.travel && <Travel data={data} />}
      {data.sectionsEnabled.registry && <Registry data={data} />}
      {data.sectionsEnabled.faq && <Faq data={data} />}
      {data.sectionsEnabled.gallery && <Gallery data={data} />}
      <Footer data={data} />
    </div>
  );
}
