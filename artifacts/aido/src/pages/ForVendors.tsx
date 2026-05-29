import { ChangeEvent, FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle,
  ChevronDown,
  HeartHandshake,
  ImagePlus,
  Loader2,
  Mail,
  MapPin,
  Search,
  Share2,
  Sparkles,
  Store,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/authFetch";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  "Venue",
  "Planner",
  "Photographer",
  "Videographer",
  "Florist",
  "DJ / Music",
  "Catering",
  "Beauty",
  "Attire",
  "Transportation",
  "Decor / Rentals",
  "Other",
];

type VendorServicePhoto = {
  name: string;
  type: string;
  dataUrl: string;
};

type VendorPartnerForm = {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  category: string;
  serviceArea: string;
  website: string;
  instagram: string;
  startingPrice: string;
  description: string;
  businessLogo: VendorServicePhoto | null;
  servicePhotos: VendorServicePhoto[];
};

type VendorPartnerTextField = Exclude<keyof VendorPartnerForm, "businessLogo" | "servicePhotos">;

const EMPTY_FORM: VendorPartnerForm = {
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  category: "",
  serviceArea: "",
  website: "",
  instagram: "",
  startingPrice: "",
  description: "",
  businessLogo: null,
  servicePhotos: [],
};

const BENEFITS = [
  {
    icon: Store,
    title: "Free Vendor Profile",
    body: "Showcase your business in a curated wedding planning experience.",
  },
  {
    icon: BadgeCheck,
    title: "Exclusive Badge",
    body: "Approved partners receive an A.I DO badge for their site and socials.",
  },
  {
    icon: Users,
    title: "Targeted Leads",
    body: "Reach couples who are actively organizing guests, budgets, and vendors.",
  },
  {
    icon: HeartHandshake,
    title: "Mutual Promotion",
    body: "You help introduce A.I DO. We help introduce your services.",
  },
];

const STEPS = [
  {
    icon: BriefcaseBusiness,
    title: "1. Get Featured",
    body: "We review your application and create a polished vendor listing.",
  },
  {
    icon: Share2,
    title: "2. Cross-Promote",
    body: "Add your partner badge to your site, proposals, or social channels.",
  },
  {
    icon: Sparkles,
    title: "3. Grow Together",
    body: "Couples discover trusted vendors while planning inside A.I DO.",
  },
];

const MAX_SERVICE_PHOTOS = 3;
const MAX_PHOTO_BYTES = 750 * 1024;
type VendorPartnerPage = "home" | "vendors" | "how-it-works" | "apply";

function getVendorPartnerPage(path: string): VendorPartnerPage {
  if (path.endsWith("/vendors")) return "vendors";
  if (path.endsWith("/how-it-works")) return "how-it-works";
  if (path.endsWith("/apply")) return "apply";
  return "vendors";
}

function vendorPartnerNavClass(isActive: boolean) {
  return `rounded-full px-3 py-2 transition ${
    isActive
      ? "bg-[#FFF7F2] text-[#8D294D]"
      : "text-[#6F3E54] hover:bg-[#FFF7F2] hover:text-[#8D294D]"
  }`;
}

export default function ForVendors() {
  const [location] = useLocation();
  const page = getVendorPartnerPage(location);
  const [form, setForm] = useState<VendorPartnerForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const updateField = (field: VendorPartnerTextField, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
    setError("");
  };

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const remainingSlots = MAX_SERVICE_PHOTOS - form.servicePhotos.length;
    if (remainingSlots <= 0) {
      setError(`You can upload up to ${MAX_SERVICE_PHOTOS} service photos.`);
      event.target.value = "";
      return;
    }
    const selectedFiles = files.slice(0, remainingSlots);
    const oversized = selectedFiles.find((file) => file.size > MAX_PHOTO_BYTES);
    if (oversized) {
      setError("Each service photo must be under 750 KB.");
      event.target.value = "";
      return;
    }
    const invalid = selectedFiles.find((file) => !/^image\/(jpeg|png|webp)$/i.test(file.type));
    if (invalid) {
      setError("Please upload JPG, PNG, or WEBP images.");
      event.target.value = "";
      return;
    }
    const photos = await Promise.all(selectedFiles.map(readPhotoFile));
    setForm(current => ({
      ...current,
      servicePhotos: [...current.servicePhotos, ...photos].slice(0, MAX_SERVICE_PHOTOS),
    }));
    setError("");
    event.target.value = "";
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Business logo must be under 750 KB.");
      event.target.value = "";
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setError("Please upload a JPG, PNG, or WEBP logo.");
      event.target.value = "";
      return;
    }
    const logo = await readPhotoFile(file);
    setForm(current => ({ ...current, businessLogo: logo }));
    setError("");
    event.target.value = "";
  };

  const removePhoto = (index: number) => {
    setForm(current => ({
      ...current,
      servicePhotos: current.servicePhotos.filter((_, photoIndex) => photoIndex !== index),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const r = await apiFetch("/api/vendor-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error ?? "Could not submit application");
      setSubmitted(true);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF7F2] text-[#3B1C2B]">
      <header className="sticky top-0 z-20 border-b border-[#E8DDE8] bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="A.I DO" className="h-14 w-auto object-contain" />
          </Link>
          <nav className="hidden items-center gap-2 text-sm font-bold md:flex">
            <Link href="/" className={vendorPartnerNavClass(false)}>Home</Link>
            <Link href="/for-vendors/vendors" className={vendorPartnerNavClass(page === "vendors")}>Benefits</Link>
            <Link href="/for-vendors/how-it-works" className={vendorPartnerNavClass(page === "how-it-works")}>How It Works</Link>
            <Link href="/for-vendors/apply" className={vendorPartnerNavClass(page === "apply")}>Apply</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild className="rounded-lg bg-[#8D294D] px-5 text-white hover:bg-[#762140]">
              <Link href="/for-vendors/apply">Partner With Us</Link>
            </Button>
            <Link href="/sign-in">
              <Button variant="ghost" size="icon" className="hidden text-[#6F3E54] hover:bg-[#FFF7F2] sm:inline-flex">
                <Search className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {page === "home" && (
        <section className="relative min-h-[560px] overflow-hidden">
          <img
            src="/images/default-wedding-couple.jpg"
            alt="Wedding couple"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,247,242,0.96)_0%,rgba(255,247,242,0.86)_43%,rgba(255,247,242,0.18)_100%)]" />
          <div className="relative mx-auto flex min-h-[560px] max-w-6xl items-center px-4 py-16 sm:px-8">
            <div className="max-w-xl">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E6C7D0] bg-white/75 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#B16C8E]">
                <Sparkles className="h-4 w-4" />
                Partner With Us
              </p>
              <h1 className="font-serif text-5xl font-bold leading-tight text-[#8D294D] sm:text-6xl">
                Partner with A.I DO
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-8 text-[#3B1C2B]">
                Get listed with A.I DO, reach couples as they plan, and share a trusted badge on your site or socials.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-12 rounded-lg bg-[#8D294D] px-8 text-base font-bold text-white shadow-lg shadow-[#8D294D]/25 hover:bg-[#762140]">
                  <Link href="/for-vendors/apply">Partner With Us</Link>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-lg border-[#E6A6B7] bg-white/80 px-8 text-base font-bold text-[#6F3E54] hover:bg-white">
                  <Link href="/for-vendors/vendors">See Benefits</Link>
                </Button>
              </div>
            </div>
            <div className="absolute bottom-10 right-6 hidden lg:block">
              <VendorBadge size="large" />
            </div>
          </div>
        </section>
        )}

        {(page === "home" || page === "vendors") && (
        <section id="benefits" className="bg-white px-4 py-14 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center font-serif text-4xl font-bold text-[#8D294D]">
              Why Partner With Us?
            </h2>
            <div className="mt-9 grid gap-5 md:grid-cols-4">
              {BENEFITS.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <div key={benefit.title} className="rounded-lg bg-[#F8F6FA] px-6 py-7 text-center shadow-sm">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F5E1EC] text-[#C95F91]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-[#3B1C2B]">{benefit.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#6F3E54]">{benefit.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        )}

        {(page === "home" || page === "how-it-works") && (
        <section id="how-it-works" className="bg-[#FAF9FC] px-4 py-16 sm:px-8">
          <div className="mx-auto max-w-6xl text-center">
            <h2 className="font-serif text-4xl font-bold text-[#8D294D]">How It Works</h2>
            <p className="mt-3 text-lg text-[#3B1C2B]">We create a profile page for your business.</p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="relative rounded-lg border border-[#EEE7F0] bg-white px-7 pb-7 pt-12 shadow-sm">
                    <div className="absolute left-1/2 top-0 flex h-16 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#F5E7E8] text-[#C97E91]">
                      <Icon className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-bold text-[#8D294D]">{step.title}</h3>
                    <div className="mx-auto my-4 h-px w-4/5 bg-[#EEE7F0]" />
                    <p className="text-sm leading-6 text-[#3B1C2B]">{step.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        )}

        {(page === "home" || page === "apply") && (
        <section id="apply" className="bg-[#FFF7F2] px-4 py-14 sm:px-8">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="space-y-6">
              <div>
                <h2 className="font-serif text-4xl font-bold text-[#8D294D]">Ready to Partner?</h2>
                <p className="mt-3 text-lg text-[#3B1C2B]">
                  Tell us about your business and we will review your fit for the A.I DO partner network.
                </p>
              </div>
              <VendorBadge />
              <div className="rounded-lg border border-[#E8DDE8] bg-white p-5">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#B16C8E]">What approved vendors receive</p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-[#6F3E54]">
                  <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8D294D]" /> A vendor profile in the A.I DO directory.</li>
                  <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8D294D]" /> An official partner badge with your A.I DO listing link.</li>
                  <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8D294D]" /> Mutual promotion opportunities as the directory grows.</li>
                </ul>
              </div>
            </div>

            <section className="rounded-lg border border-[#E8DDE8] bg-white p-5 shadow-[0_20px_45px_rgba(90,80,124,0.12)] sm:p-7">
              {submitted ? (
                <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <CheckCircle className="h-9 w-9" />
                  </div>
                  <div>
                    <h2 className="font-serif text-3xl text-[#8D294D]">Application received</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-[#6F3E54]">
                      Thanks for reaching out. Your submission has been received and we will follow up directly.
                    </p>
                  </div>
                  <Button className="rounded-lg bg-[#8D294D] text-white hover:bg-[#762140]" onClick={() => setSubmitted(false)}>
                    Submit another vendor
                  </Button>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <h3 className="font-serif text-3xl font-bold text-[#8D294D]">Apply Now</h3>
                    <p className="mt-1 text-sm text-[#6F3E54]">Quick and easy. No cost to join.</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Business Name" required value={form.businessName} onChange={value => updateField("businessName", value)} />
                    <Field label="Your Name" required value={form.contactName} onChange={value => updateField("contactName", value)} />
                    <Field label="Your Email" type="email" required value={form.email} onChange={value => updateField("email", value)} />
                    <Field label="Phone" value={form.phone} onChange={value => updateField("phone", value)} />
                    <label className="relative space-y-1.5 text-sm font-semibold text-[#8D294D]">
                      Category <span className="text-[#B16C8E]">*</span>
                      <select
                        required
                        value={form.category}
                        onChange={event => updateField("category", event.target.value)}
                        className="h-12 w-full appearance-none rounded-lg border border-[#E6A6B7] bg-white px-3 pr-10 text-sm font-normal text-[#3B1C2B] outline-none focus:border-[#8D294D]"
                      >
                        <option value="">Choose category</option>
                        {CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 text-[#6F3E54]" />
                    </label>
                    <Field label="Service Area" required placeholder="Ex: South Florida" value={form.serviceArea} onChange={value => updateField("serviceArea", value)} />
                    <Field label="Website" value={form.website} onChange={value => updateField("website", value)} />
                    <Field label="Instagram" placeholder="@yourbusiness" value={form.instagram} onChange={value => updateField("instagram", value)} />
                    <Field label="Starting Price" placeholder="Ex: Packages from $2,500" value={form.startingPrice} onChange={value => updateField("startingPrice", value)} className="sm:col-span-2" />
                  </div>

                  <label className="block space-y-1.5 text-sm font-semibold text-[#8D294D]">
                    Tell us about your services
                    <textarea
                      value={form.description}
                      onChange={event => updateField("description", event.target.value)}
                      rows={5}
                      className="w-full resize-none rounded-lg border border-[#E6A6B7] bg-white px-3 py-2 text-sm font-normal text-[#3B1C2B] outline-none focus:border-[#8D294D]"
                      placeholder="What do you offer, what couples are a great fit, and what makes your work stand out?"
                    />
                  </label>

                  <div className="space-y-3 rounded-lg border border-dashed border-[#E6A6B7] bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#8D294D]">Business logo</p>
                        <p className="text-xs leading-5 text-[#6F3E54]">
                          Upload your logo so your partner profile can show your real branding.
                        </p>
                      </div>
                      <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#E6A6B7] bg-[#FFF7F2] px-4 text-sm font-semibold text-[#8D294D] hover:border-[#8D294D]">
                        <ImagePlus className="h-4 w-4" />
                        Upload logo
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={handleLogoUpload}
                        />
                      </label>
                    </div>

                    {form.businessLogo && (
                      <div className="flex items-center gap-3 rounded-lg border border-[#E8DDE8] bg-[#FFF7F2] p-3">
                        <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-lg border border-[#E8DDE8] bg-white">
                          <img src={form.businessLogo.dataUrl} alt={form.businessLogo.name} className="h-full w-full object-contain p-2" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#3B1C2B]">{form.businessLogo.name}</p>
                          <p className="text-xs text-[#6F3E54]">Logo ready for your profile.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForm(current => ({ ...current, businessLogo: null }))}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#8D294D] shadow-sm transition hover:bg-[#F8E3EE]"
                          aria-label="Remove business logo"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-[#6F3E54]">
                      JPG, PNG, or WEBP. Transparent PNG works best. Keep the logo under 750 KB.
                    </p>
                  </div>

                  <div className="space-y-3 rounded-lg border border-dashed border-[#D9D1E3] bg-[#FAF9FC] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#8D294D]">Service photos</p>
                        <p className="text-xs leading-5 text-[#6F3E54]">
                          Upload up to 3 examples for your future vendor profile.
                        </p>
                      </div>
                      <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#E6A6B7] bg-white px-4 text-sm font-semibold text-[#8D294D] hover:border-[#8D294D]">
                        <ImagePlus className="h-4 w-4" />
                        Upload photos
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="sr-only"
                          onChange={handlePhotoUpload}
                        />
                      </label>
                    </div>

                    {form.servicePhotos.length > 0 && (
                      <div className="grid grid-cols-3 gap-3">
                        {form.servicePhotos.map((photo, index) => (
                          <div key={`${photo.name}-${index}`} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-[#E8DDE8] bg-white">
                            <img src={photo.dataUrl} alt={photo.name} className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removePhoto(index)}
                              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#8D294D] shadow-sm transition hover:bg-white"
                              aria-label={`Remove ${photo.name}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-[#6F3E54]">
                      JPG, PNG, or WEBP. Keep each photo under 750 KB.
                    </p>
                  </div>

                  {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                  <Button type="submit" disabled={submitting} className="h-12 w-full rounded-lg bg-[#8D294D] text-base font-bold text-white hover:bg-[#762140]">
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Apply Now
                  </Button>
                </form>
              )}
            </section>
          </div>
        </section>
        )}

        {(page === "home" || page === "vendors") && (
        <section className="bg-white px-4 py-14 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex items-center gap-5">
              <div className="h-px flex-1 bg-[#EEE7F0]" />
              <h2 className="text-center font-serif text-3xl font-bold text-[#8D294D]">Built for Wedding Professionals</h2>
              <div className="h-px flex-1 bg-[#EEE7F0]" />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <QuoteCard quote="A.I DO helps couples stay organized, which makes every vendor conversation clearer from the start." name="Partner-ready planning" />
              <QuoteCard quote="The directory gives vendors a clean way to be discovered while sharing the planning tool with their own audience." name="Mutual growth" />
            </div>
          </div>
        </section>
        )}
      </main>
    </div>
  );
}

function readPhotoFile(file: File): Promise<VendorServicePhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read photo."));
        return;
      }
      resolve({
        name: file.name,
        type: file.type,
        dataUrl: reader.result,
      });
    };
    reader.onerror = () => reject(new Error("Could not read photo."));
    reader.readAsDataURL(file);
  });
}

function VendorBadge({ size = "default" }: { size?: "default" | "large" }) {
  return (
    <div className={`rounded-lg border border-[#E8DDE8] bg-white shadow-[0_16px_38px_rgba(90,80,124,0.16)] ${size === "large" ? "px-7 py-5" : "px-5 py-4"}`}>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#F8E3EE] ring-1 ring-[#E0B6CC]">
          <img src="/logo.png" alt="A.I DO logo" className="h-12 w-12 object-contain" />
        </div>
        <div>
          <p className="font-serif text-lg leading-none text-[#B16C8E]">Proud Partner of</p>
          <p className="font-serif text-4xl leading-tight text-[#8D294D]">A.I DO</p>
          <p className="text-xs font-semibold text-[#6F3E54]">AI Wedding Planner Assistant</p>
        </div>
      </div>
    </div>
  );
}

function QuoteCard({ quote, name }: { quote: string; name: string }) {
  return (
    <div className="rounded-lg border border-[#EEE7F0] bg-[#FAF9FC] p-7 shadow-sm">
      <p className="text-base leading-7 text-[#3B1C2B]">"{quote}"</p>
      <div className="mt-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5E1EC] text-[#8D294D]">
          <MapPin className="h-5 w-5" />
        </div>
        <p className="font-semibold text-[#8D294D]">{name}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`space-y-1.5 text-sm font-semibold text-[#8D294D] ${className}`}>
      {label} {required && <span className="text-[#B16C8E]">*</span>}
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        className="h-12 w-full rounded-lg border border-[#E6A6B7] bg-white px-3 text-sm font-normal text-[#3B1C2B] outline-none focus:border-[#8D294D]"
      />
    </label>
  );
}
