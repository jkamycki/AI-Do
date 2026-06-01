import { useMemo } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Check, Globe, Instagram, Loader2, Mail, Star } from "lucide-react";
import { apiFetch } from "@/lib/authFetch";
import { qrSvgDataUrl } from "@/lib/localQr";
import { Button } from "@/components/ui/button";

type VendorDirectoryListing = {
  about: string;
  category: string;
  contactName: string;
  email: string;
  fit: string;
  gallery: string[];
  id: string;
  instagram: string;
  location: string;
  logoUrl?: string;
  logoLabel: string;
  name: string;
  phone: string;
  price: number;
  reviews: number;
  rating: string;
  responseTime: string;
  services: string[];
  tags: string[];
  website: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string })?.error || response.statusText);
  return body as T;
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Custom quote";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function isUsableImageSrc(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function safeWebsiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function PublicVendorProfile() {
  const [, params] = useRoute("/vendors/:partnerId");
  const partnerId = params?.partnerId ?? "";
  const profileUrl = `https://aidowedding.net/vendors/${encodeURIComponent(partnerId)}`;

  const query = useQuery({
    queryKey: ["public-vendor-partner-profile", partnerId],
    enabled: !!partnerId,
    queryFn: async () => readJson<{ listing: VendorDirectoryListing }>(
      await apiFetch(`/api/vendor-partners/directory/${encodeURIComponent(partnerId)}`),
    ),
  });

  const listing = query.data?.listing;
  const galleryImages = useMemo(() => listing?.gallery.filter(isUsableImageSrc).slice(0, 4) ?? [], [listing]);
  const websiteUrl = listing ? safeWebsiteUrl(listing.website) : "";

  if (query.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF7F2] text-[#5B0F2A]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    );
  }

  if (query.isError || !listing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF7F2] px-4">
        <section className="max-w-xl rounded-2xl border border-[#E8C9D4] bg-white p-8 text-center shadow-[0_24px_70px_rgba(91,15,42,0.12)]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8D294D]">A.I DO Partner</p>
          <h1 className="mt-3 font-serif text-4xl text-[#5B0F2A]">Profile not found</h1>
          <p className="mt-3 text-[#6F3E54]">This partner profile may not be published yet.</p>
          <Button asChild className="mt-6 rounded-full bg-[#8D294D] px-6 text-white hover:bg-[#762140]">
            <a href="/">Visit A.I DO</a>
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FFF7F2] px-4 py-8 text-[#3B1C2B] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-[#E8C9D4] bg-white/95 p-5 shadow-[0_20px_60px_rgba(91,15,42,0.10)] md:grid md:grid-cols-[150px_1fr_auto] md:items-center">
          <div className="flex h-28 items-center justify-center rounded-xl border border-[#E8C9D4] bg-[#FFF7F2] px-4 text-center">
            {isUsableImageSrc(listing.logoUrl) ? (
              <img src={listing.logoUrl} alt={`${listing.name} logo`} className="h-full w-full object-contain p-2" />
            ) : (
              <div>
                <p className="font-serif text-2xl leading-none text-[#8D294D]">{listing.logoLabel}</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#B16C8E]">{listing.category}</p>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8D294D]">A.I DO Partner Profile</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight text-[#5B0F2A]">{listing.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="flex items-center gap-0.5 text-amber-500">
                {Array.from({ length: 5 }, (_, index) => <Star key={index} className="h-4 w-4 fill-current" />)}
              </span>
              <span className="font-semibold text-[#3B1C2B]">{listing.rating}</span>
              <span className="text-[#6F3E54]">({listing.reviews} reviews)</span>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              <InfoTile label="Category" value={listing.category} />
              <InfoTile label="Starting Price" value={`From ${formatCurrency(listing.price)}`} />
              <InfoTile label="Service Area" value={listing.location} />
            </div>
          </div>
          <div className="rounded-xl border border-[#E8C9D4] bg-[#FFF7F2] p-3 text-center">
            <img src={qrSvgDataUrl(profileUrl, 3, 2)} alt={`${listing.name} profile QR code`} className="mx-auto h-24 w-24 rounded-lg bg-white p-1 shadow-sm" />
            <p className="mt-2 text-xs font-semibold text-[#8D294D]">Share this profile</p>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
          <section className="space-y-5">
            {galleryImages.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {galleryImages.map((src, index) => (
                  <img
                    key={`${listing.id}-gallery-${index}`}
                    src={src}
                    alt={`${listing.name} service example ${index + 1}`}
                    className="aspect-[4/3] w-full rounded-xl border border-[#E8C9D4] bg-white object-cover shadow-sm"
                  />
                ))}
              </div>
            )}

            <ContentCard title="About Us">
              <p className="text-sm leading-7 text-[#3B1C2B]/90">{listing.about}</p>
            </ContentCard>

            <ContentCard title="Services">
              <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {listing.services.map((service) => (
                  <div key={service} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-[#8D294D]" />
                    {service}
                  </div>
                ))}
              </div>
            </ContentCard>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-2xl border border-[#E8C9D4] bg-white p-5 shadow-sm">
              <h2 className="font-serif text-2xl font-semibold text-[#5B0F2A]">Contact</h2>
              <div className="mt-5 space-y-4 text-sm">
                <a className="grid grid-cols-[18px_1fr] gap-3 text-[#6F3E54] hover:text-[#8D294D]" href={`mailto:${listing.email}`}>
                  <Mail className="mt-0.5 h-4 w-4 text-[#8D294D]" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-[#3B1C2B]">Email</span>
                    <span className="block break-words">{listing.email}</span>
                  </span>
                </a>
                {listing.instagram && (
                  <div className="grid grid-cols-[18px_1fr] gap-3 text-[#6F3E54]">
                    <Instagram className="mt-0.5 h-4 w-4 text-[#8D294D]" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-[#3B1C2B]">Instagram</span>
                      <span className="block break-words">{listing.instagram}</span>
                    </span>
                  </div>
                )}
                {websiteUrl && (
                  <a className="grid grid-cols-[18px_1fr] gap-3 text-[#6F3E54] hover:text-[#8D294D]" href={websiteUrl} target="_blank" rel="noreferrer">
                    <Globe className="mt-0.5 h-4 w-4 text-[#8D294D]" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-[#3B1C2B]">Website</span>
                      <span className="block break-words">{websiteUrl.replace(/^https?:\/\//, "")}</span>
                    </span>
                  </a>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-[#E8C9D4] bg-white shadow-sm">
              <div className="flex items-center gap-3 bg-[linear-gradient(90deg,#FFF7F2,#FFFFFF)] p-4">
                <img src="/logo-optimized.jpg" alt="A.I DO logo" className="h-12 w-12 shrink-0 object-contain" loading="lazy" decoding="async" />
                <div>
                  <p className="text-[11px] font-semibold text-[#8D294D]">Proud Partner of</p>
                  <p className="font-serif text-3xl leading-none text-[#8D294D]">A.I DO</p>
                  <p className="text-[10px] text-[#6F3E54]">AI Wedding Planner Assistant</p>
                </div>
              </div>
              <div className="border-t border-[#E8C9D4] p-4">
                <p className="text-sm leading-6 text-[#6F3E54]">
                  Planning a wedding? Use A.I DO to build your website, manage RSVPs, organize vendors, collect photos, and keep your planning in one place.
                </p>
                <Button asChild className="mt-4 w-full rounded-full bg-[#8D294D] text-white hover:bg-[#762140]">
                  <a href="/?utm_source=vendor_badge&utm_medium=partner_profile">Plan with A.I DO</a>
                </Button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#FFF7F2] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#B16C8E]">{label}</p>
      <p className="mt-0.5 font-semibold text-[#3B1C2B]">{value}</p>
    </div>
  );
}

function ContentCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E8C9D4] bg-white p-5 shadow-sm">
      <h2 className="border-b border-[#E8C9D4] pb-3 font-serif text-2xl font-semibold text-[#5B0F2A]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
