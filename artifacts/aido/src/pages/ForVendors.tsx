import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle, Handshake, Loader2, Mail, MapPin, Sparkles } from "lucide-react";
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

const EMPTY_FORM = {
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
};

type VendorPartnerForm = typeof EMPTY_FORM;

export default function ForVendors() {
  const [form, setForm] = useState<VendorPartnerForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const updateField = (field: keyof VendorPartnerForm, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
    setError("");
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
    <div className="min-h-screen bg-[#FFF7F2] text-[#8D294D]">
      <header className="border-b border-[#E6A6B7]/60 bg-[#FFF7F2]/95 px-4 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link href="/">
            <Button variant="ghost" className="gap-2 text-[#8D294D] hover:bg-white/50">
              <ArrowLeft className="h-4 w-4" />
              A.I Do
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button className="rounded-full bg-[#8D294D] text-white hover:bg-[#7C3F5E]">Sign in</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-12">
        <section className="space-y-6">
          <img src="/logo.png" alt="A.I Do" className="h-28 w-auto object-contain" />
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E6A6B7] bg-white/70 px-4 py-2 text-sm font-semibold text-[#B16C8E]">
              <Sparkles className="h-4 w-4" />
              Vendor partner intake
            </div>
            <h1 className="max-w-xl font-serif text-4xl leading-tight text-[#8D294D] sm:text-5xl">
              Partner with couples already planning inside A.I Do.
            </h1>
            <p className="max-w-xl text-base leading-7 text-[#7C3F5E]/80">
              Tell us about your business, where you serve, and what kind of weddings you love. We will review fit from the Operations Center and follow up directly.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[#F2CFC6] bg-white/75 p-4">
              <Handshake className="mb-3 h-5 w-5 text-[#B16C8E]" />
              <h2 className="font-semibold text-[#8D294D]">Preferred vendor list</h2>
              <p className="mt-1 text-sm text-[#7C3F5E]/70">Start building a curated network before opening broad listings.</p>
            </div>
            <div className="rounded-lg border border-[#F2CFC6] bg-white/75 p-4">
              <MapPin className="mb-3 h-5 w-5 text-[#B16C8E]" />
              <h2 className="font-semibold text-[#8D294D]">Local discovery</h2>
              <p className="mt-1 text-sm text-[#7C3F5E]/70">Track categories and markets as vendor interest comes in.</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#E6A6B7]/70 bg-white p-5 shadow-[0_20px_45px_rgba(141,41,77,0.12)] sm:p-7">
          {submitted ? (
            <div className="flex min-h-[560px] flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle className="h-9 w-9" />
              </div>
              <div>
                <h2 className="font-serif text-3xl text-[#8D294D]">Application received</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#7C3F5E]/75">
                  Thanks for reaching out. Your submission is now in the Operations Center for review.
                </p>
              </div>
              <Button className="rounded-full bg-[#8D294D] text-white hover:bg-[#7C3F5E]" onClick={() => setSubmitted(false)}>
                Submit another vendor
              </Button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <h2 className="font-serif text-3xl text-[#8D294D]">Vendor application</h2>
                <p className="mt-1 text-sm text-[#7C3F5E]/70">Fields marked required help us sort and follow up cleanly.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business name" required value={form.businessName} onChange={value => updateField("businessName", value)} />
                <Field label="Contact name" required value={form.contactName} onChange={value => updateField("contactName", value)} />
                <Field label="Email" type="email" required value={form.email} onChange={value => updateField("email", value)} />
                <Field label="Phone" value={form.phone} onChange={value => updateField("phone", value)} />
                <label className="space-y-1.5 text-sm font-semibold text-[#8D294D]">
                  Category <span className="text-[#B16C8E]">*</span>
                  <select
                    required
                    value={form.category}
                    onChange={event => updateField("category", event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#E6A6B7]/80 bg-white px-3 text-sm font-normal text-[#4B2E3A] outline-none focus:border-[#8D294D]"
                  >
                    <option value="">Choose category</option>
                    {CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <Field label="Service area" required placeholder="Ex: South Florida, NYC, Online" value={form.serviceArea} onChange={value => updateField("serviceArea", value)} />
                <Field label="Website" value={form.website} onChange={value => updateField("website", value)} />
                <Field label="Instagram" placeholder="@yourbusiness" value={form.instagram} onChange={value => updateField("instagram", value)} />
                <Field label="Starting price" placeholder="Ex: Packages from $2,500" value={form.startingPrice} onChange={value => updateField("startingPrice", value)} className="sm:col-span-2" />
              </div>

              <label className="block space-y-1.5 text-sm font-semibold text-[#8D294D]">
                Tell us about your services
                <textarea
                  value={form.description}
                  onChange={event => updateField("description", event.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-lg border border-[#E6A6B7]/80 bg-white px-3 py-2 text-sm font-normal text-[#4B2E3A] outline-none focus:border-[#8D294D]"
                  placeholder="What do you offer, what couples are a great fit, and what makes your work stand out?"
                />
              </label>

              {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              <Button type="submit" disabled={submitting} className="h-12 w-full rounded-full bg-[#8D294D] text-white hover:bg-[#7C3F5E]">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Submit application
              </Button>
            </form>
          )}
        </section>
      </main>
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
        className="h-11 w-full rounded-lg border border-[#E6A6B7]/80 bg-white px-3 text-sm font-normal text-[#4B2E3A] outline-none focus:border-[#8D294D]"
      />
    </label>
  );
}
