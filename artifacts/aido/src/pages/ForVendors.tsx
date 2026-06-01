import { ChangeEvent, FormEvent, ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle,
  ChevronDown,
  Globe2,
  HeartHandshake,
  ImagePlus,
  Instagram,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Search,
  Share2,
  Sparkles,
  Star,
  Store,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/authFetch";
import { Button } from "@/components/ui/button";
import { ImageCropDialog, type CropQueueItem } from "@/components/ImageCropDialog";
import { qrSvgDataUrl } from "@/lib/localQr";
import { publicAppOrigin } from "@/lib/publicUrls";
import { organizationSchema, setSeo } from "@/lib/seo";

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
  about: string;
  services: string;
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
  about: "",
  services: "",
  businessLogo: null,
  servicePhotos: [],
};

const BENEFITS = [
  {
    icon: Store,
    title: "Free Beta Listing",
    body: "Get a polished A.I DO vendor profile at no cost while the founding program is open.",
  },
  {
    icon: BadgeCheck,
    title: "Founding Partner Badge",
    body: "Approved early vendors receive a founding badge they can share on their site and socials.",
  },
  {
    icon: Users,
    title: "Priority Early Placement",
    body: "Be one of the first vendors couples see as A.I DO begins opening to engaged couples.",
  },
  {
    icon: HeartHandshake,
    title: "Help Shape The Network",
    body: "Share feedback on what would make the vendor side useful enough to pay for later.",
  },
];

const STEPS = [
  {
    icon: BriefcaseBusiness,
    title: "1. Apply For Free",
    body: "Send your business details, logo, photos, service area, and the services you want couples to see.",
  },
  {
    icon: Share2,
    title: "2. Get Listed Early",
    body: "We review your application, create your profile, and mark approved vendors as founding partners.",
  },
  {
    icon: Sparkles,
    title: "3. Grow With A.I DO",
    body: "Share your listing, give honest feedback, and get priority placement as couples start joining.",
  },
];

const MAX_SERVICE_PHOTOS = 3;
const MAX_PHOTO_MB = 5;
const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;
const VENDOR_LOGO_MAX_DIMENSION = 700;
const VENDOR_SERVICE_PHOTO_MAX_DIMENSION = 1200;
const VENDOR_OPTIMIZED_IMAGE_QUALITY = 0.72;
type VendorPartnerPage = "home" | "vendors" | "how-it-works" | "apply" | "sample-profile";

function getVendorPartnerPage(path: string): VendorPartnerPage {
  const cleanPath = path.replace(/\/+$/, "");
  if (cleanPath === "/for-vendors/vendors") return "vendors";
  if (cleanPath === "/for-vendors/how-it-works") return "how-it-works";
  if (cleanPath === "/for-vendors/apply") return "apply";
  if (cleanPath === "/for-vendors/sample-profile") return "sample-profile";
  return "home";
}

function vendorPartnerNavClass(isActive: boolean) {
  return `shrink-0 rounded-full px-3 py-2 transition ${
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
  const [cropMode, setCropMode] = useState<"logo" | "service" | null>(null);
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropTotal, setCropTotal] = useState(0);

  useEffect(() => {
    const titleByPage: Record<VendorPartnerPage, string> = {
      home: "Founding Wedding Vendor Program | A.I DO",
      vendors: "Founding Wedding Vendor Program | A.I DO",
      "how-it-works": "How A.I DO Founding Vendor Partnerships Work",
      apply: "Apply to Join the A.I DO Founding Vendor Program",
      "sample-profile": "Sample Founding Vendor Profile | A.I DO",
    };
    const descriptionByPage: Record<VendorPartnerPage, string> = {
      home: "Apply for A.I DO's founding wedding vendor program: free beta listing, founding partner badge, priority early placement, and profile visibility as A.I DO grows.",
      vendors: "Apply for A.I DO's founding wedding vendor program: free beta listing, founding partner badge, priority early placement, and profile visibility as A.I DO grows.",
      "how-it-works": "See how A.I DO founding vendors get listed early, share a polished vendor profile, and help shape the vendor network before paid partnerships launch.",
      apply: "Apply for a free founding vendor profile on A.I DO. Share your logo, photos, services, and feedback while the platform grows its first couple audience.",
      "sample-profile": "Preview a sample A.I DO founding vendor profile with services, photos, contact links, QR code sharing, and founding partner badge placement.",
    };
    setSeo({
      title: titleByPage[page],
      description: descriptionByPage[page],
      path: page === "vendors" ? "/for-vendors" : `/for-vendors/${page}`,
      jsonLd: organizationSchema(),
    });
  }, [page]);

  const updateField = (field: VendorPartnerTextField, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
    setError("");
  };

  const cropItem: CropQueueItem | null = cropQueue.length > 0 && cropQueue[0]
    ? {
      file: cropQueue[0],
      index: cropTotal - cropQueue.length,
      total: cropTotal,
    }
    : null;

  const clearCropQueue = () => {
    setCropMode(null);
    setCropQueue([]);
    setCropTotal(0);
  };

  const advanceCropQueue = () => {
    setCropQueue((current) => {
      const next = current.slice(1);
      if (next.length === 0) {
        setCropMode(null);
        setCropTotal(0);
      }
      return next;
    });
  };

  const addCroppedPhoto = async (file: File) => {
    try {
      if (cropMode === "logo") {
        const photo = await readPhotoFile(await optimizeVendorImage(file, VENDOR_LOGO_MAX_DIMENSION));
        setForm(current => ({ ...current, businessLogo: photo }));
      } else if (cropMode === "service") {
        const photo = await readPhotoFile(await optimizeVendorImage(file, VENDOR_SERVICE_PHOTO_MAX_DIMENSION));
        setForm(current => ({
          ...current,
          servicePhotos: [...current.servicePhotos, photo].slice(0, MAX_SERVICE_PHOTOS),
        }));
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read photo.");
    } finally {
      advanceCropQueue();
    }
  };

  const onCropComplete = (croppedFile: File) => {
    void addCroppedPhoto(croppedFile);
  };

  const onCropSkip = () => {
    const original = cropQueue[0];
    if (original) void addCroppedPhoto(original);
    else advanceCropQueue();
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
      setError(`Each service photo must be under ${MAX_PHOTO_MB} MB.`);
      event.target.value = "";
      return;
    }
    const invalid = selectedFiles.find((file) => !/^image\/(jpeg|png|webp)$/i.test(file.type));
    if (invalid) {
      setError("Please upload JPG, PNG, or WEBP images.");
      event.target.value = "";
      return;
    }
    setCropMode("service");
    setCropQueue(selectedFiles);
    setCropTotal(selectedFiles.length);
    setError("");
    event.target.value = "";
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      setError(`Business logo must be under ${MAX_PHOTO_MB} MB.`);
      event.target.value = "";
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setError("Please upload a JPG, PNG, or WEBP logo.");
      event.target.value = "";
      return;
    }
    setCropMode("logo");
    setCropQueue([file]);
    setCropTotal(1);
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
    <div className="min-h-screen overflow-x-hidden bg-[#FFF7F2] text-[#3B1C2B]">
      <header className="sticky top-0 z-20 border-b border-[#E8DDE8] bg-white/95 px-4 py-2 shadow-sm backdrop-blur sm:px-8 sm:py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="A.I DO" className="h-10 w-auto object-contain sm:h-14" />
          </Link>
          <nav className="hidden items-center gap-2 text-sm font-bold md:flex">
            <Link href="/" className={vendorPartnerNavClass(false)}>Home</Link>
            <Link href="/for-vendors/vendors" className={vendorPartnerNavClass(page === "vendors")}>Benefits</Link>
            <Link href="/for-vendors/how-it-works" className={vendorPartnerNavClass(page === "how-it-works")}>How It Works</Link>
            <Link href="/for-vendors/apply" className={vendorPartnerNavClass(page === "apply")}>Apply</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild className="h-10 rounded-lg bg-[#8D294D] px-3 text-sm text-white hover:bg-[#762140] sm:px-5">
              <Link href="/for-vendors/apply"><span className="sm:hidden">Partner</span><span className="hidden sm:inline">Partner With Us</span></Link>
            </Button>
            <Link href="/sign-in">
              <Button variant="ghost" size="icon" className="hidden text-[#6F3E54] hover:bg-[#FFF7F2] sm:inline-flex">
                <Search className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
        <nav className="mx-auto mt-2 flex max-w-6xl gap-2 overflow-x-auto pb-1 text-xs font-bold [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden" aria-label="Vendor partner sections">
          <Link href="/" className={vendorPartnerNavClass(false)}>Home</Link>
          <Link href="/for-vendors/vendors" className={vendorPartnerNavClass(page === "vendors")}>Benefits</Link>
          <Link href="/for-vendors/how-it-works" className={vendorPartnerNavClass(page === "how-it-works")}>How It Works</Link>
          <Link href="/for-vendors/apply" className={vendorPartnerNavClass(page === "apply")}>Apply</Link>
        </nav>
      </header>

      <main>
        {page === "sample-profile" && (
          <section className="bg-[#FFF7F2] px-4 py-10 sm:px-8">
            <div className="mx-auto max-w-6xl">
              <MockDirectoryPreview compact showBackLink />
            </div>
          </section>
        )}

        {page === "home" && (
        <section className="relative min-h-[520px] overflow-hidden sm:min-h-[560px]">
          <img
            src="/images/default-wedding-couple.jpg"
            alt="Wedding couple"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,247,242,0.98)_0%,rgba(255,247,242,0.9)_54%,rgba(255,247,242,0.32)_100%)] sm:bg-[linear-gradient(90deg,rgba(255,247,242,0.96)_0%,rgba(255,247,242,0.86)_43%,rgba(255,247,242,0.18)_100%)]" />
          <div className="relative mx-auto grid min-h-[520px] max-w-6xl items-center gap-8 px-4 py-10 sm:min-h-[560px] sm:px-8 sm:py-16 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="max-w-xl">
              <p className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-[#E6C7D0] bg-white/75 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#B16C8E] sm:px-4 sm:tracking-[0.22em]">
                <Sparkles className="h-4 w-4" />
                Founding Vendor Program
              </p>
              <h1 className="font-serif text-[2.6rem] font-bold leading-[1.05] text-[#8D294D] sm:text-6xl">
                Become a founding A.I DO vendor
              </h1>
              <p className="mt-4 max-w-lg text-base leading-7 text-[#3B1C2B] sm:mt-5 sm:text-lg sm:leading-8">
                Join the beta vendor network for free, get a polished profile you can share, and help shape how couples discover vendors inside A.I DO.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-12 w-full rounded-lg bg-[#8D294D] px-8 text-base font-bold text-white shadow-lg shadow-[#8D294D]/25 hover:bg-[#762140] sm:w-auto">
                  <Link href="/for-vendors/apply">Apply Free</Link>
                </Button>
                <Button asChild variant="outline" className="h-12 w-full rounded-lg border-[#E6A6B7] bg-white/80 px-8 text-base font-bold text-[#6F3E54] hover:bg-white sm:w-auto">
                  <a href="#partner-profile-preview">See Profile Mock</a>
                </Button>
              </div>
            </div>
            <div className="hidden lg:block">
              <HeroProfileMock />
            </div>
          </div>
        </section>
        )}

        {(page === "home" || page === "vendors") && (
        <section className="bg-[#FFFDFB] px-4 py-14 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <MockDirectoryPreview />
          </div>
        </section>
        )}

        {(page === "home" || page === "vendors") && (
        <section id="benefits" className="bg-white px-4 py-14 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center font-serif text-3xl font-bold leading-tight text-[#8D294D] sm:text-4xl">
              Founding Vendor Offer
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-6 text-[#6F3E54] sm:text-base sm:leading-7">
              This is not a paid marketplace yet. Early approved vendors get free beta visibility while A.I DO builds its first couple audience.
            </p>
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
            <h2 className="font-serif text-3xl font-bold leading-tight text-[#8D294D] sm:text-4xl">How It Works</h2>
            <p className="mt-3 text-base leading-7 text-[#3B1C2B] sm:text-lg">Apply once, get listed early, and help shape the vendor experience before paid partnerships launch.</p>
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
                <h2 className="font-serif text-3xl font-bold leading-tight text-[#8D294D] sm:text-4xl">Apply as a Founding Vendor</h2>
                <p className="mt-3 text-base leading-7 text-[#3B1C2B] sm:text-lg">
                  Tell us about your business and we will review your fit for the free founding vendor beta.
                </p>
              </div>
              <VendorBadge />
              <div className="rounded-lg border border-[#E8DDE8] bg-white p-5">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#B16C8E]">What founding vendors get</p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-[#6F3E54]">
                  <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8D294D]" /> Free vendor profile/listing during beta.</li>
                  <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8D294D]" /> Founding Partner badge and priority early placement.</li>
                  <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8D294D]" /> SEO exposure as your profile grows with the platform.</li>
                  <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8D294D]" /> Optional testimonials or case studies once A.I DO has early users.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-[#E8DDE8] bg-white p-5">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#B16C8E]">What we ask from you</p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-[#6F3E54]">
                  <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8D294D]" /> Complete the application with logo, photos, services, and contact details.</li>
                  <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8D294D]" /> Share your A.I DO listing once it is live.</li>
                  <li className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8D294D]" /> Give honest feedback on what would make a paid vendor plan valuable later.</li>
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
                    <p className="mt-1 text-sm text-[#6F3E54]">Free beta listing. No contract. No vendor fee while the founding program is open.</p>
                  </div>

                  <div className="rounded-lg border border-[#E8DDE8] bg-[#FFF7F2] p-4">
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#B16C8E]">Business details</p>
                    <p className="mt-1 text-xs leading-5 text-[#6F3E54]">
                      These fields build the top card on your A.I DO partner profile.
                    </p>
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
                    Short profile intro
                    <span className="block text-xs font-normal leading-5 text-[#6F3E54]">
                      This appears as the quick summary near your name, category, price, and service area.
                    </span>
                    <textarea
                      value={form.description}
                      onChange={event => updateField("description", event.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-[#E6A6B7] bg-white px-3 py-2 text-sm font-normal text-[#3B1C2B] outline-none focus:border-[#8D294D]"
                      placeholder="Ex: Editorial wedding photography with soft film tones, calm direction, and full-day storytelling."
                    />
                  </label>

                  <label className="block space-y-1.5 text-sm font-semibold text-[#8D294D]">
                    About Us <span className="text-[#B16C8E]">*</span>
                    <span className="block text-xs font-normal leading-5 text-[#6F3E54]">
                      This is the public About Us section couples will see on your A.I DO partner profile.
                    </span>
                    <textarea
                      required
                      value={form.about}
                      onChange={event => updateField("about", event.target.value)}
                      rows={5}
                      className="w-full resize-none rounded-lg border border-[#E6A6B7] bg-white px-3 py-2 text-sm font-normal text-[#3B1C2B] outline-none focus:border-[#8D294D]"
                      placeholder="Tell couples who you are, your style, what the experience feels like, and what makes your work a strong fit."
                    />
                  </label>

                  <label className="block space-y-1.5 text-sm font-semibold text-[#8D294D]">
                    Services <span className="text-[#B16C8E]">*</span>
                    <span className="block text-xs font-normal leading-5 text-[#6F3E54]">
                      Add one service per line. These publish as the checklist-style Services section.
                    </span>
                    <textarea
                      required
                      value={form.services}
                      onChange={event => updateField("services", event.target.value)}
                      rows={5}
                      className="w-full resize-none rounded-lg border border-[#E6A6B7] bg-white px-3 py-2 text-sm font-normal text-[#3B1C2B] outline-none focus:border-[#8D294D]"
                      placeholder={"Full wedding day coverage\nEngagement sessions\nSecond photographer\nOnline gallery delivery"}
                    />
                  </label>

                  <div className="space-y-3 rounded-lg border border-dashed border-[#E6A6B7] bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#8D294D]">Business logo</p>
                        <p className="text-xs leading-5 text-[#6F3E54]">
                          Upload your logo, then crop and position it for your partner profile.
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
                      JPG, PNG, or WEBP. Transparent PNG works best. Keep the logo under {MAX_PHOTO_MB} MB.
                    </p>
                  </div>

                  <div className="space-y-3 rounded-lg border border-dashed border-[#D9D1E3] bg-[#FAF9FC] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#8D294D]">Service photos</p>
                        <p className="text-xs leading-5 text-[#6F3E54]">
                          Upload up to 3 examples, then crop and position each one for your future vendor profile.
                        </p>
                      </div>
                      <label className="inline-flex h-10 w-full shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#E6A6B7] bg-white px-4 text-sm font-semibold leading-none text-[#8D294D] hover:border-[#8D294D] sm:w-auto sm:min-w-[154px]">
                        <ImagePlus className="h-4 w-4 shrink-0" />
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
                      JPG, PNG, or WEBP. Keep each photo under {MAX_PHOTO_MB} MB.
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
              <h2 className="text-center font-serif text-2xl font-bold leading-tight text-[#8D294D] sm:text-3xl">Built for Wedding Professionals</h2>
              <div className="h-px flex-1 bg-[#EEE7F0]" />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <QuoteCard quote="A.I DO helps couples stay organized, which makes every vendor conversation clearer from the start." name="Partner-ready planning" />
              <QuoteCard quote="Founding vendors get early visibility now, then help define what a future paid vendor plan should actually include." name="Built with vendors" />
            </div>
          </div>
        </section>
        )}
      </main>
      <ImageCropDialog
        item={cropItem}
        onComplete={onCropComplete}
        onSkip={onCropSkip}
        onCancelAll={clearCropQueue}
        initialAspect={cropMode === "logo" ? "square" : "wide"}
      />
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

async function optimizeVendorImage(file: File, maxDimension: number): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not prepare image."));
      image.src = imageUrl;
    });
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", VENDOR_OPTIMIZED_IMAGE_QUALITY));
    if (!blob) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}-optimized.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
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
          <p className="text-xs font-semibold text-[#6F3E54]">Founding Vendor Partner</p>
        </div>
      </div>
    </div>
  );
}

function HeroProfileMock() {
  return (
    <div className="ml-auto max-w-[34rem] rounded-[2rem] border border-[#E6C7D0]/80 bg-white/82 p-4 shadow-[0_24px_70px_rgba(90,80,124,0.18)] backdrop-blur">
      <div className="overflow-hidden rounded-[1.4rem] border border-[#E8DDE8] bg-[#FFF7F2]">
        <div className="grid grid-cols-[1.1fr_0.9fr] gap-3 p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <div className="flex h-16 w-20 items-center justify-center rounded-xl border border-[#E6C7D0] bg-[#FFFDFB]">
                <div className="text-center">
                  <p className="font-serif text-lg leading-none text-[#8D294D]">Everly</p>
                  <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-[#B16C8E]">Studio</p>
                </div>
              </div>
              <div className="min-w-0">
                <p className="font-serif text-2xl font-bold leading-tight text-[#24171D]">Everly Rose Photo</p>
                <p className="mt-1 text-xs font-semibold text-[#6F3E54]">Photography | Florida</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <img src="/images/default-wedding-couple.jpg" alt="Mock vendor profile gallery" className="aspect-square rounded-xl object-cover" />
              <img src="/images/floral-bg.png" alt="Mock vendor details" className="aspect-square rounded-xl object-cover" />
              <img src="/images/bokeh-bg.png" alt="Mock vendor reception" className="aspect-square rounded-xl object-cover" />
            </div>
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B16C8E]">Services</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Wedding day coverage", "Engagements", "Online gallery"].map((service) => (
                  <span key={service} className="rounded-full bg-[#FFF7F2] px-2 py-1 text-[10px] font-bold text-[#6F3E54]">{service}</span>
                ))}
              </div>
            </div>
          </div>
          <aside className="space-y-3">
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <VendorBadge />
            </div>
            <div className="rounded-2xl bg-[#8D294D] p-3 text-white shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/75">Couple action</p>
              <p className="mt-2 font-serif text-2xl leading-tight">Message Partner</p>
              <p className="mt-2 text-xs leading-5 text-white/82">Couples can view your work and contact you from the profile.</p>
            </div>
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-xs font-bold text-[#8D294D]">Starting Price</p>
              <p className="font-serif text-2xl text-[#24171D]">From $3,200</p>
            </div>
          </aside>
        </div>
      </div>
      <p className="mt-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-[#8D294D]">Mock profile preview</p>
    </div>
  );
}

function MockDirectoryPreview({ compact = false, showBackLink = false }: { compact?: boolean; showBackLink?: boolean }) {
  const demoProfileUrl = `${publicAppOrigin()}/for-vendors/sample-profile`;
  const mockQrUrl = qrSvgDataUrl(demoProfileUrl, 7, 3);
  const services = [
    "Full wedding day coverage",
    "Engagement session",
    "Second photographer",
    "Online gallery delivery",
    "Timeline planning support",
    "Soft editorial direction",
  ];

  return (
    <div id="partner-profile-preview" className={`${compact ? "mt-0" : "mt-14"} text-left`}>
      {!compact && (
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#B16C8E]">Directory preview</p>
        <h3 className="mt-2 font-serif text-3xl font-bold text-[#8D294D] sm:text-4xl">
          What your partner profile can look like
        </h3>
        <p className="mt-3 text-sm leading-6 text-[#6F3E54] sm:text-base sm:leading-7">
          Founding vendors fill out the intake once, upload their logo and service photos, and A.I DO turns it into a clean profile couples can understand quickly.
        </p>
      </div>
      )}

      <div className="mt-8 rounded-[1.25rem] border border-[#E8DDE8] bg-[#FFF7F2] p-4 shadow-[0_24px_55px_rgba(90,80,124,0.12)] sm:p-6">
        {showBackLink && (
        <Link href="/for-vendors/how-it-works#partner-profile-preview" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#8D294D] hover:underline">
          <span aria-hidden="true">&lt;-</span>
          Back to partner network
        </Link>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-5">
            <section className="rounded-lg border border-[#E6C7D0] bg-white/60 p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-24 w-full items-center justify-center rounded-lg border border-[#E6C7D0] bg-white sm:w-32">
                  <div className="text-center">
                    <p className="font-serif text-2xl leading-none text-[#8D294D]">Everly</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#B16C8E]">Studio</p>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-serif text-3xl font-bold text-[#24171D]">Everly Rose Photo</h4>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#3B1C2B]">
                    <span className="inline-flex text-[#F59E0B]" aria-label="Five star rating">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star key={index} className="h-4 w-4 fill-current" />
                      ))}
                    </span>
                    <strong>New</strong>
                    <span>(0 reviews)</span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <ProfileStat label="Category" value="Photography" />
                    <ProfileStat label="Starting Price" value="From $3,200" />
                    <ProfileStat label="Service Area" value="Florida" />
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-3 gap-3">
              <img src="/images/default-wedding-couple.jpg" alt="Mock vendor ceremony example" className="aspect-[4/3] rounded-lg border border-[#E6C7D0] object-cover shadow-sm" />
              <img src="/images/floral-bg.png" alt="Mock vendor detail example" className="aspect-[4/3] rounded-lg border border-[#E6C7D0] object-cover shadow-sm" />
              <img src="/images/bokeh-bg.png" alt="Mock vendor reception example" className="aspect-[4/3] rounded-lg border border-[#E6C7D0] object-cover shadow-sm" />
            </div>

            <PreviewPanel title="About Us">
              <p className="text-sm leading-7 text-[#3B1C2B]">
                Everly Rose Photo creates warm, true-to-color wedding imagery with calm direction, documentary moments, and polished portraits that feel natural from getting ready through the final dance.
              </p>
            </PreviewPanel>

            <PreviewPanel title="Services">
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {services.map((service) => (
                  <div key={service} className="flex items-start gap-2 text-sm text-[#3B1C2B]">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8D294D]" />
                    <span>{service}</span>
                  </div>
                ))}
              </div>
            </PreviewPanel>
          </div>

          <aside className="space-y-4">
            <section className="rounded-lg border border-[#E6C7D0] bg-white/70 p-4 shadow-sm">
              <h4 className="font-serif text-xl font-bold text-[#24171D]">Contact Us</h4>
              <Button className="mt-4 h-11 w-full rounded-lg bg-[linear-gradient(110deg,#D98290,#A75ED6)] text-white hover:opacity-95">
                <MessageCircle className="mr-2 h-4 w-4" />
                Message Partner
              </Button>
              <p className="mt-4 text-xs leading-5 text-[#6F3E54]">
                Couples can start a discovery message without adding the partner to their vendor list.
              </p>
              <div className="mt-5 space-y-4 text-sm text-[#3B1C2B]">
                <ContactLine icon={Mail} label="Email" value="hello@everlyrose.example" />
                <ContactLine icon={Instagram} label="Instagram" value="@everlyrosephoto" />
                <ContactLine icon={Globe2} label="Website" value="everlyrose.example" />
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-[#E6C7D0] bg-white/70 shadow-sm">
              <div className="flex items-center gap-3 p-4">
                <img src="/logo.png" alt="A.I DO logo" className="h-10 w-10 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#8D294D]">Founding Partner of</p>
                  <p className="font-serif text-2xl leading-none text-[#8D294D]">A.I DO</p>
                  <p className="text-[10px] text-[#6F3E54]">Free beta vendor profile</p>
                </div>
                <img
                  src={mockQrUrl}
                  alt="Mock A.I DO partner profile QR code"
                  title={demoProfileUrl}
                  className="h-16 w-16 shrink-0 rounded bg-white p-1 shadow-sm"
                />
              </div>
              <div className="border-t border-[#E6C7D0] bg-[#FFF7F2] px-4 py-3 text-center text-sm font-medium text-[#6F3E54]">
                Scan to view this profile
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#B16C8E]">{label}</p>
      <p className="mt-1 font-semibold text-[#24171D]">{value}</p>
    </div>
  );
}

function PreviewPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#E6C7D0] bg-white/60 p-4 shadow-sm sm:p-5">
      <h4 className="font-serif text-xl font-bold text-[#24171D]">{title}</h4>
      <div className="my-3 h-px bg-[#E6C7D0]" />
      {children}
    </section>
  );
}

function ContactLine({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#8D294D]" />
      <div className="min-w-0">
        <p className="font-bold">{label}</p>
        <p className="break-words text-[#6F3E54]">{value}</p>
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
