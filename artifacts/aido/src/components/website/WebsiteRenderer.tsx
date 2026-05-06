import { useEffect, useState } from "react";
import { Calendar, MapPin, Heart, Clock, Gift, HelpCircle, Image as ImageIcon } from "lucide-react";
import { EditableText } from "./EditableText";

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

// Edit mode props passed to every section (and its EditableText spans).
interface EditCtx {
  editable: boolean;
  onTextChange: (key: string, value: string) => void;
}
const NOOP_CTX: EditCtx = { editable: false, onTextChange: () => {} };

function fontStack(font: string): string {
  return `'${font}', 'Playfair Display', Georgia, serif`;
}

function bodyFontStack(font: string): string {
  return `'${font}', system-ui, -apple-system, sans-serif`;
}

function imageUrl(url: string): string {
  if (url.startsWith("/objects/")) return `/api/storage${url}`;
  return url;
}

function headingFont(data: WebsiteRendererPayload): string {
  return (data.customText._headingFont || "").trim() || data.font;
}

function bodyFont(data: WebsiteRendererPayload): string {
  return (data.customText._bodyFont || "").trim() || "Inter";
}


function Hero({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
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
        <EditableText
          as="div"
          editable={ctx.editable}
          value={data.customText._heroTagline ?? ""}
          defaultValue="We're getting married"
          onCommit={(v) => ctx.onTextChange("_heroTagline", v)}
          className="uppercase tracking-[0.3em] text-xs sm:text-sm mb-6 opacity-80"
          style={{ color: data.heroImage ? "#fff" : data.colorPalette.primary }}
        />
        <h1 className="text-5xl sm:text-7xl md:text-8xl mb-6 leading-tight" style={{ fontFamily: fontStack(headingFont(data)) }}>
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
  titleKey,
  defaultTitle,
  icon,
  children,
  data,
  ctx,
}: {
  id: string;
  titleKey: string;
  defaultTitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  data: WebsiteRendererPayload;
  ctx: EditCtx;
}) {
  return (
    <section id={id} className="py-20 px-6" style={{ background: id === "gallery" ? data.colorPalette.neutral : data.colorPalette.background }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-3" style={{ color: data.colorPalette.primary }}>
          {icon}
          <EditableText
            editable={ctx.editable}
            value={data.customText[titleKey] ?? ""}
            defaultValue={defaultTitle}
            onCommit={(v) => ctx.onTextChange(titleKey, v)}
            className="uppercase tracking-[0.25em] text-xs"
          />
        </div>
        <div className="w-12 h-px mx-auto mb-12" style={{ background: data.colorPalette.primary }} />
        {children}
      </div>
    </section>
  );
}

function Welcome({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const text = data.customText.welcome ?? "";
  // In edit mode, always render so the user has somewhere to type. In
  // public mode, hide the section if there's no text.
  if (!text && !ctx.editable) return null;
  return (
    <SectionShell id="welcome" titleKey="welcome_title" defaultTitle="Welcome" icon={<Heart className="h-4 w-4" />} data={data} ctx={ctx}>
      <EditableText
        as="div"
        multiline
        editable={ctx.editable}
        value={text}
        defaultValue={ctx.editable ? "Click to write a warm welcome for your guests..." : ""}
        onCommit={(v) => ctx.onTextChange("welcome", v)}
        className="text-center text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto whitespace-pre-line"
        style={{ color: data.colorPalette.text, fontFamily: bodyFontStack(bodyFont(data)) }}
      />
    </SectionShell>
  );
}

function Story({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const text = data.customText.story ?? "";
  if (!text && !ctx.editable) return null;
  return (
    <SectionShell id="story" titleKey="story_title" defaultTitle="Our Story" icon={<Heart className="h-4 w-4" />} data={data} ctx={ctx}>
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.story_subtitle ?? ""}
        defaultValue="How we got here"
        onCommit={(v) => ctx.onTextChange("story_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-8"
        style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.text }}
      />
      <EditableText
        as="div"
        multiline
        editable={ctx.editable}
        value={text}
        defaultValue={ctx.editable ? "Tell guests how you two met, your story, your journey..." : ""}
        onCommit={(v) => ctx.onTextChange("story", v)}
        className="text-center text-base sm:text-lg leading-relaxed max-w-2xl mx-auto whitespace-pre-line"
        style={{ color: data.colorPalette.text, fontFamily: bodyFontStack(bodyFont(data)) }}
      />
    </SectionShell>
  );
}

function Schedule({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const events = data.timeline ?? [];
  const hasFallback = data.couple.ceremonyTime || data.couple.receptionTime;
  if (events.length === 0 && !hasFallback && !ctx.editable) return null;
  return (
    <SectionShell id="schedule" titleKey="schedule_title" defaultTitle="Schedule" icon={<Clock className="h-4 w-4" />} data={data} ctx={ctx}>
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.schedule_subtitle ?? ""}
        defaultValue="The day of"
        onCommit={(v) => ctx.onTextChange("schedule_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-10"
        style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.text }}
      />
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

function Travel({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const text = data.customText.travel ?? "";
  if (!text && !data.couple.venue && !ctx.editable) return null;
  return (
    <SectionShell id="travel" titleKey="travel_title" defaultTitle="Travel & Venue" icon={<MapPin className="h-4 w-4" />} data={data} ctx={ctx}>
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.travel_subtitle ?? ""}
        defaultValue="Where & how to get there"
        onCommit={(v) => ctx.onTextChange("travel_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-8"
        style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.text }}
      />
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
      <EditableText
        as="div"
        multiline
        editable={ctx.editable}
        value={text}
        defaultValue={ctx.editable ? "Add hotel recommendations, parking info, directions..." : ""}
        onCommit={(v) => ctx.onTextChange("travel", v)}
        className="text-center text-base sm:text-lg leading-relaxed max-w-2xl mx-auto whitespace-pre-line"
        style={{ color: data.colorPalette.text, fontFamily: bodyFontStack(bodyFont(data)) }}
      />
    </SectionShell>
  );
}

function Registry({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const text = data.customText.registry ?? "";
  if (!text && !ctx.editable) return null;
  return (
    <SectionShell id="registry" titleKey="registry_title" defaultTitle="Registry" icon={<Gift className="h-4 w-4" />} data={data} ctx={ctx}>
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.registry_subtitle ?? ""}
        defaultValue="With love"
        onCommit={(v) => ctx.onTextChange("registry_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-8"
        style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.text }}
      />
      <EditableText
        as="div"
        multiline
        editable={ctx.editable}
        value={text}
        defaultValue={ctx.editable ? "Share your registry links and gift preferences..." : ""}
        onCommit={(v) => ctx.onTextChange("registry", v)}
        className="text-center text-base sm:text-lg leading-relaxed max-w-2xl mx-auto whitespace-pre-line"
        style={{ color: data.colorPalette.text, fontFamily: bodyFontStack(bodyFont(data)) }}
      />
    </SectionShell>
  );
}

function Faq({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const text = data.customText.faq ?? "";
  if (!text && !ctx.editable) return null;
  return (
    <SectionShell id="faq" titleKey="faq_title" defaultTitle="FAQ" icon={<HelpCircle className="h-4 w-4" />} data={data} ctx={ctx}>
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.faq_subtitle ?? ""}
        defaultValue="Good to know"
        onCommit={(v) => ctx.onTextChange("faq_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-8"
        style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.text }}
      />
      <EditableText
        as="div"
        multiline
        editable={ctx.editable}
        value={text}
        defaultValue={ctx.editable ? "Answer common guest questions: dress code, parking, kids welcome, plus-ones..." : ""}
        onCommit={(v) => ctx.onTextChange("faq", v)}
        className="text-center text-base sm:text-lg leading-relaxed max-w-2xl mx-auto whitespace-pre-line"
        style={{ color: data.colorPalette.text, fontFamily: bodyFontStack(bodyFont(data)) }}
      />
    </SectionShell>
  );
}

function Gallery({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const images = (data.galleryImages ?? []).slice().sort((a, b) => a.order - b.order);
  if (images.length === 0 && !ctx.editable) return null;
  return (
    <SectionShell id="gallery" titleKey="gallery_title" defaultTitle="Gallery" icon={<ImageIcon className="h-4 w-4" />} data={data} ctx={ctx}>
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.gallery_subtitle ?? ""}
        defaultValue="Moments"
        onCommit={(v) => ctx.onTextChange("gallery_subtitle", v)}
        className="block text-center text-3xl sm:text-4xl mb-10"
        style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.text }}
      />
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

export interface WeddingPartyMember {
  photo: string;
  name: string;
  role: string;
}

export function parseWeddingPartyMembers(raw: string | undefined): WeddingPartyMember[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && typeof m === "object")
      .map((m) => ({
        photo: typeof m.photo === "string" ? m.photo : "",
        name: typeof m.name === "string" ? m.name : "",
        role: typeof m.role === "string" ? m.role : "",
      }));
  } catch {
    return [];
  }
}

function WeddingParty({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const members = parseWeddingPartyMembers(data.customText._weddingPartyMembers);
  if (members.length === 0 && !ctx.editable) return null;
  return (
    <SectionShell id="weddingParty" titleKey="weddingParty_title" defaultTitle="Wedding Party" icon={<Heart className="h-4 w-4" />} data={data} ctx={ctx}>
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText.weddingParty_subtitle ?? ""}
        defaultValue="Meet our family & friends standing with us"
        onCommit={(v) => ctx.onTextChange("weddingParty_subtitle", v)}
        className="block text-center text-base sm:text-lg max-w-2xl mx-auto mb-12 opacity-80"
        style={{ color: data.colorPalette.text, fontFamily: bodyFontStack(bodyFont(data)) }}
      />
      {members.length === 0 ? (
        <p className="text-center text-sm opacity-60" style={{ color: data.colorPalette.text }}>
          No wedding party members yet — add some from the sidebar.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10 max-w-3xl mx-auto">
          {members.map((m, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <div
                className="w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden mb-4 flex items-center justify-center"
                style={{ background: `${data.colorPalette.primary}15`, border: `1px solid ${data.colorPalette.primary}33` }}
              >
                {m.photo ? (
                  <img src={imageUrl(m.photo)} alt={m.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <Heart className="h-8 w-8 opacity-30" style={{ color: data.colorPalette.primary }} />
                )}
              </div>
              <div className="text-2xl sm:text-3xl mb-1" style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.primary }}>
                {m.name || "Name"}
              </div>
              <div className="text-sm opacity-80" style={{ color: data.colorPalette.text, fontFamily: bodyFontStack(bodyFont(data)) }}>
                {m.role || "Role"}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function Footer({ data, ctx }: { data: WebsiteRendererPayload; ctx: EditCtx }) {
  const couple = `${data.couple.partner1Name} & ${data.couple.partner2Name}`;
  const dateStr = formatWeddingDate(data.couple.weddingDate);
  return (
    <footer className="py-12 px-6 text-center" style={{ background: data.colorPalette.primary, color: "#fff" }}>
      <div className="text-2xl mb-2" style={{ fontFamily: fontStack(headingFont(data)) }}>{couple}</div>
      <EditableText
        as="div"
        editable={ctx.editable}
        value={data.customText._footerText ?? ""}
        defaultValue={dateStr}
        onCommit={(v) => ctx.onTextChange("_footerText", v)}
        className="text-sm opacity-80 whitespace-pre-line"
      />
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
  if (data.sectionsEnabled.weddingParty) items.push({ id: "weddingParty", label: "Wedding Party" });
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
          style={{ fontFamily: fontStack(headingFont(data)), color: data.colorPalette.primary }}
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
                fontFamily: fontStack(headingFont(data)),
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

export function WebsiteRenderer({
  data,
  scrollContainer,
  editable = false,
  onTextChange,
}: {
  data: WebsiteRendererPayload;
  scrollContainer?: HTMLElement | null;
  editable?: boolean;
  onTextChange?: (key: string, value: string) => void;
}) {
  const ctx: EditCtx = editable && onTextChange
    ? { editable: true, onTextChange }
    : NOOP_CTX;
  return (
    <div style={{ background: data.colorPalette.background, color: data.colorPalette.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <TopNav data={data} scrollContainer={scrollContainer} />
      <Hero data={data} ctx={ctx} />
      {data.sectionsEnabled.welcome && <Welcome data={data} ctx={ctx} />}
      {data.sectionsEnabled.story && <Story data={data} ctx={ctx} />}
      {data.sectionsEnabled.schedule && <Schedule data={data} ctx={ctx} />}
      {data.sectionsEnabled.travel && <Travel data={data} ctx={ctx} />}
      {data.sectionsEnabled.registry && <Registry data={data} ctx={ctx} />}
      {data.sectionsEnabled.weddingParty && <WeddingParty data={data} ctx={ctx} />}
      {data.sectionsEnabled.faq && <Faq data={data} ctx={ctx} />}
      {data.sectionsEnabled.gallery && <Gallery data={data} ctx={ctx} />}
      <Footer data={data} ctx={ctx} />
    </div>
  );
}
