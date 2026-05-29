import { useEffect, useMemo, useState } from "react";
import type { ComponentProps, ElementType, ReactNode } from "react";
import { useUser } from "@clerk/react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSaveProfile, getGetProfileQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";
import { VenueWizard, emptyVenueDiscoveryData, type VenueDiscoveryData } from "@/components/Profile/VenueWizard";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  Mail,
  MapPin,
  MessageCircle,
  Search,
  Sparkles,
} from "lucide-react";
import i18n, { LANG_NAME_TO_CODE } from "@/i18n";

const ONBOARDING_KEY_PREFIX = "aido_onboarding_dismissed";
export const ARIA_ONBOARDING_PROMPT_KEY = "aido_aria_initial_prompt";

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Chinese (Simplified)",
  "Japanese",
  "Korean",
  "Arabic",
  "Hindi",
  "Russian",
  "Dutch",
  "Polish",
];

const VENDOR_OPTIONS = [
  "Photographer",
  "Videographer",
  "Caterer",
  "DJ or band",
  "Florist",
  "Officiant",
  "Cake or dessert baker",
  "Hair stylist",
  "Makeup artist",
  "Rentals",
  "Wedding planner",
  "Transportation",
];

const STEPS = [
  "Welcome",
  "Names",
  "Date",
  "Budget",
  "Venue",
  "Vendors",
  "Partner",
  "Aria",
] as const;

type VenueChoice = "booked" | "looking" | "non_traditional";

const emptyPlanningPriorities = {
  mustHaves: [] as string[],
  niceToHaves: [] as string[],
  mustAvoids: [] as string[],
};

const schema = z.object({
  accountType: z.literal("couple_individual").default("couple_individual"),
  partner1Name: z.string().default(""),
  partner2Name: z.string().default(""),
  sharedLastName: z.string().default(""),
  weddingDate: z.string().default(""),
  ceremonyTime: z.string().default("16:00"),
  receptionTime: z.string().default("18:00"),
  venueChoice: z.enum(["booked", "looking", "non_traditional"]).default("looking"),
  venue: z.string().default(""),
  location: z.string().default(""),
  guestCount: z.coerce.number().default(100),
  totalBudget: z.coerce.number().default(20000),
  weddingVibe: z.string().default("Warm, elegant, and organized"),
  preferredLanguage: z.string().default("English"),
  venueDiscovery: z.custom<VenueDiscoveryData>().default(emptyVenueDiscoveryData),
  bookedVendors: z.array(z.string()).default([]),
  partnerEmail: z.string().default(""),
  ariaPrompt: z.string().default(""),
});

type WizardValues = z.infer<typeof schema>;

function freshVenueDiscovery(): VenueDiscoveryData {
  return {
    ...emptyVenueDiscoveryData,
    style: [...emptyVenueDiscoveryData.style],
    requirements: {
      mustHaves: {
        ...emptyVenueDiscoveryData.requirements.mustHaves,
        selected: [...emptyVenueDiscoveryData.requirements.mustHaves.selected],
      },
      niceToHaves: {
        ...emptyVenueDiscoveryData.requirements.niceToHaves,
        selected: [...emptyVenueDiscoveryData.requirements.niceToHaves.selected],
      },
      mustNotHaves: {
        ...emptyVenueDiscoveryData.requirements.mustNotHaves,
        selected: [...emptyVenueDiscoveryData.requirements.mustNotHaves.selected],
      },
    },
    shortlist: [],
    screenshots: [],
  };
}

function prepareCoupleNames(values: WizardValues) {
  const sharedLastName = values.sharedLastName.trim();
  return {
    partner2Name: values.partner2Name.trim(),
    partner1Name: [values.partner1Name.trim(), sharedLastName].filter(Boolean).join(" "),
  };
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "";
}

function coupleDisplay(values: WizardValues) {
  const first = firstName(values.partner2Name);
  const second = firstName(values.partner1Name);
  return [first, second].filter(Boolean).join(" & ") || "you both";
}

function normalizeMoney(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function normalizeGuests(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(1, Math.round(numeric)) : 1;
}

function defaultTargetWeddingDate() {
  const target = new Date();
  target.setFullYear(target.getFullYear() + 1);
  return target.toISOString().slice(0, 10);
}

function venueDiscoveryForSave(values: WizardValues) {
  const discovery = {
    ...freshVenueDiscovery(),
    ...values.venueDiscovery,
    guestCount: values.venueDiscovery.guestCount || String(normalizeGuests(values.guestCount)),
    budgetRange: values.venueDiscovery.budgetRange || (normalizeMoney(values.totalBudget) ? `$${normalizeMoney(values.totalBudget).toLocaleString()}` : ""),
    location: values.venueDiscovery.location || values.location,
    notes: [
      values.venueDiscovery.notes,
      values.venueChoice === "non_traditional" ? "The couple may use a non-traditional venue or private location." : "",
    ].filter(Boolean).join("\n"),
  };

  return {
    ...discovery,
    style: Array.isArray(discovery.style) ? discovery.style : [],
    shortlist: Array.isArray(discovery.shortlist) ? discovery.shortlist : [],
    screenshots: Array.isArray(discovery.screenshots) ? discovery.screenshots : [],
  };
}

function ChoiceCard({
  active,
  title,
  description,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: ElementType;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-start gap-4 rounded-[1.4rem] border p-4 text-left transition-all duration-200 ${
        active
          ? "border-[#9c3158] bg-[#fff7f8] shadow-[0_14px_34px_rgba(156,49,88,0.14)] ring-1 ring-[#9c3158]/10"
          : "border-[#ead2ca] bg-white/85 hover:-translate-y-0.5 hover:border-[#d4a373] hover:shadow-[0_12px_28px_rgba(94,53,59,0.10)]"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          active ? "bg-[#9c3158] text-white" : "bg-[#f7dde2] text-[#9c3158] group-hover:bg-[#f3d19d] group-hover:text-[#6d3f2d]"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-[#3c252b]">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-[#835f66]">{description}</span>
      </span>
    </button>
  );
}

function StepShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-4xl rounded-[2rem] border border-[#f0d5d9] bg-white/86 p-5 shadow-[0_22px_60px_rgba(99,55,64,0.11)] backdrop-blur sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow && (
            <p className="mb-3 inline-flex rounded-full bg-[#f7dde2] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#9c3158]">
              {eyebrow}
            </p>
          )}
          <h2 className="max-w-2xl font-serif text-3xl leading-tight text-[#3c252b] sm:text-5xl">{title}</h2>
        </div>
        <span className="hidden rounded-full border border-[#e8cfc5] bg-[#fffaf6] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#b7804e] sm:inline-flex">
          A.I Do
        </span>
      </div>
      {description && <p className="mt-4 max-w-2xl text-base leading-7 text-[#73565d] sm:text-lg sm:leading-8">{description}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function PrimaryButton(props: ComponentProps<typeof Button>) {
  const { className = "", ...buttonProps } = props;
  return (
    <Button
      {...buttonProps}
      className={`h-14 rounded-full bg-[#9c3158] px-8 text-base font-bold text-white shadow-[0_14px_30px_rgba(156,49,88,0.22)] transition hover:bg-[#812446] ${className}`}
    />
  );
}

function SecondaryButton(props: ComponentProps<typeof Button>) {
  const { className = "", ...buttonProps } = props;
  return (
    <Button
      variant="ghost"
      {...buttonProps}
      className={`h-12 rounded-full px-6 text-[#694950] hover:bg-[#f7dde2]/60 hover:text-[#3c252b] ${className}`}
    />
  );
}

export function OnboardingWizard({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  const { user } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [skippedSteps, setSkippedSteps] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const saveProfile = useSaveProfile();

  const form = useForm<WizardValues>({
    resolver: zodResolver(schema) as Resolver<WizardValues>,
    defaultValues: {
      accountType: "couple_individual",
      partner1Name: "",
      partner2Name: "",
      sharedLastName: "",
      weddingDate: "",
      ceremonyTime: "16:00",
      receptionTime: "18:00",
      venueChoice: "looking",
      venue: "",
      location: "",
      guestCount: 100,
      totalBudget: 20000,
      weddingVibe: "Warm, elegant, and organized",
      preferredLanguage: "English",
      venueDiscovery: freshVenueDiscovery(),
      bookedVendors: [],
      partnerEmail: "",
      ariaPrompt: "",
    },
    mode: "onChange",
  });

  const values = form.watch();
  const coupleNames = useMemo(() => coupleDisplay(values), [values.partner1Name, values.partner2Name]);
  const venueChoice = form.watch("venueChoice") as VenueChoice;
  const bookedVendors = form.watch("bookedVendors") ?? [];
  const finalPrompt = form.watch("ariaPrompt");
  const progressPercent = Math.round(((step + 1) / STEPS.length) * 100);

  function markDismissed() {
    if (user?.id) {
      try {
        sessionStorage.setItem(`${ONBOARDING_KEY_PREFIX}:${user.id}`, "true");
      } catch {}
    }
  }

  function dismiss() {
    markDismissed();
    onDismiss();
  }

  function validateStep(targetStep = step) {
    form.clearErrors();
    const current = form.getValues();
    let valid = true;

    const requireField = (field: keyof WizardValues, message = "Required") => {
      if (!String(current[field] ?? "").trim()) {
        form.setError(field, { type: "manual", message });
        valid = false;
      }
    };

    if (targetStep === 1) {
      requireField("partner1Name", "Add one first name.");
      requireField("partner2Name", "Add the other first name.");
    }

    if (targetStep === 2) {
      requireField("weddingDate", "Add the date or a target date.");
    }

    if (targetStep === 3) {
      if (normalizeGuests(current.guestCount) < 1) {
        form.setError("guestCount", { type: "manual", message: "Guest count must be at least 1." });
        valid = false;
      }
      if (normalizeMoney(current.totalBudget) < 0) {
        form.setError("totalBudget", { type: "manual", message: "Budget must be 0 or more." });
        valid = false;
      }
    }

    if (targetStep === 4) {
      if (current.venueChoice === "booked") {
        requireField("venue", "Add the venue name.");
        requireField("location", "Add the city or location.");
      }
    }

    if (targetStep === 6) {
      const email = current.partnerEmail.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        form.setError("partnerEmail", { type: "manual", message: "Enter a valid email or leave it blank." });
        valid = false;
      }
    }

    return valid;
  }

  function next() {
    if (!validateStep()) return;
    setSkippedSteps((current) => current.filter((item) => item !== step));
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function skipCurrentStep() {
    if (step === 0) {
      dismiss();
      return;
    }

    form.clearErrors();
    setSkippedSteps((current) => current.includes(step) ? current : [...current, step]);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function back() {
    setStep((current) => Math.max(current - 1, 0));
  }

  function toggleBookedVendor(vendor: string) {
    const current = form.getValues("bookedVendors") ?? [];
    const nextVendors = current.includes(vendor)
      ? current.filter((item) => item !== vendor)
      : [...current, vendor];
    form.setValue("bookedVendors", nextVendors, { shouldDirty: true });
  }

  async function maybeInvitePartner(email: string) {
    const trimmed = email.trim();
    if (!trimmed) return;
    const response = await authFetch("/api/collaborators/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed, role: "partner" }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(typeof body.error === "string" ? body.error : "Partner invite failed.");
    }
  }

  async function complete(options: { openAria?: boolean } = {}) {
    for (let index = 1; index <= 6; index += 1) {
      if (skippedSteps.includes(index)) continue;
      if (!validateStep(index)) {
        setStep(index);
        return;
      }
    }

    const current = form.getValues();
    const saveValues = {
      ...current,
      partner2Name: current.partner2Name.trim() || user?.firstName?.trim() || "You",
      partner1Name: current.partner1Name.trim() || "Partner",
      weddingDate: current.weddingDate.trim() || defaultTargetWeddingDate(),
      location: current.location || current.venueDiscovery.location || "",
      partnerEmail:
        skippedSteps.includes(6) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(current.partnerEmail.trim())
          ? ""
          : current.partnerEmail,
    };
    const { sharedLastName } = saveValues;
    const venueStatus = saveValues.venueChoice === "booked" ? "booked" : "not_yet";
    const venueDiscovery = venueStatus === "not_yet" ? venueDiscoveryForSave(saveValues) : null;
    const location = saveValues.location || saveValues.venueDiscovery.location || (venueStatus === "not_yet" ? "Location TBD" : "");
    const prompt = saveValues.ariaPrompt.trim();

    setSaving(true);
    try {
      await saveProfile.mutateAsync({
        data: {
          ...saveValues,
          ...prepareCoupleNames({ ...saveValues, sharedLastName }),
          accountType: "couple_individual",
          venueStatus,
          venueDiscovery: venueDiscovery as Record<string, unknown> | null,
          venueBrainstorm: null,
          planningPriorities: emptyPlanningPriorities,
          venue: venueStatus === "booked" ? saveValues.venue.trim() || "Venue to be added" : "",
          location,
          guestCount: normalizeGuests(saveValues.guestCount),
          totalBudget: normalizeMoney(saveValues.totalBudget),
          weddingVibe: saveValues.weddingVibe.trim() || "Warm, elegant, and organized",
          preferredLanguage: saveValues.preferredLanguage,
        },
      });

      try {
        await maybeInvitePartner(saveValues.partnerEmail);
      } catch (inviteError) {
        toast({
          title: "Profile saved",
          description: inviteError instanceof Error ? inviteError.message : "The partner invite could not be sent yet.",
          variant: "destructive",
        });
      }

      const code = LANG_NAME_TO_CODE[saveValues.preferredLanguage] ?? "en";
      i18n.changeLanguage(code);
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["my-workspaces"] });

      if (user?.id) {
        try {
          sessionStorage.setItem(`${ONBOARDING_KEY_PREFIX}:${user.id}`, "true");
          sessionStorage.removeItem("aido_signup_account_type");
          localStorage.setItem(`aido_language_${user.id}`, code);
          localStorage.setItem(`aido_onboarding_booked_vendors_${user.id}`, JSON.stringify(saveValues.bookedVendors));
        } catch {}
      }

      if (options.openAria && prompt) {
        try {
          sessionStorage.setItem(ARIA_ONBOARDING_PROMPT_KEY, prompt);
        } catch {}
      }

      onDismiss();
      setLocation(options.openAria ? "/aria" : "/");
    } catch {
      toast({
        title: "Setup could not be saved",
        description: "Please check the details and try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && dismiss()}>
      <DialogContent
        className="max-h-[94vh] overflow-hidden border-[#efd6d9] bg-[#fffaf6] p-0 shadow-[0_30px_90px_rgba(74,35,43,0.26)] sm:max-w-[1120px]"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>A.I Do wedding setup</DialogTitle>
          <DialogDescription>Set up your wedding workspace and Aria assistant.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[94vh] overflow-y-auto bg-[#fff8f3]">
          <div className="grid min-h-[720px] lg:grid-cols-[280px_1fr]">
            <aside className="hidden border-r border-[#efd6d9] bg-[#fff3f0] px-6 py-8 lg:block">
              <div className="sticky top-8">
                <div className="rounded-[1.75rem] border border-[#f0d5d9] bg-white/80 p-5 shadow-[0_16px_38px_rgba(99,55,64,0.08)]">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#b7804e]">Setup Studio</p>
                  <h3 className="mt-3 font-serif text-3xl leading-tight text-[#3c252b]">Shape your planning hub.</h3>
                  <p className="mt-3 text-sm leading-6 text-[#73565d]">
                    A short guided setup for your A.I Do workspace, dashboard, and Aria.
                  </p>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#f0ded9]">
                    <div
                      className="h-full rounded-full bg-[#9c3158] transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[#9c3158]">{progressPercent}% ready</p>
                </div>

                <div className="mt-6 space-y-2">
                  {STEPS.map((label, index) => {
                    const active = index === step;
                    const done = index < step;
                    return (
                      <div
                        key={label}
                        className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
                          active ? "bg-white text-[#3c252b] shadow-sm" : done ? "text-[#9c3158]" : "text-[#8b6f73]"
                        }`}
                      >
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          active ? "bg-[#9c3158] text-white" : done ? "bg-[#f7dde2] text-[#9c3158]" : "bg-[#f4e7e2] text-[#8b6f73]"
                        }`}>
                          {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                        </span>
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>

            <main className="px-4 py-5 sm:px-8 sm:py-8">
              <div className="mb-5 flex items-center justify-between gap-4 lg:hidden">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b7804e]">Setup Studio</p>
                  <p className="font-serif text-2xl text-[#3c252b]">{STEPS[step]}</p>
                </div>
                <span className="rounded-full bg-[#f7dde2] px-3 py-1 text-sm font-bold text-[#9c3158]">{progressPercent}%</span>
              </div>
              <div className="mb-6 h-2 overflow-hidden rounded-full bg-[#f0ded9] lg:hidden">
                <div
                  className="h-full rounded-full bg-[#9c3158] transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <Form {...form}>
                <form onSubmit={(event) => event.preventDefault()}>
              {step === 0 && (
                <StepShell
                  eyebrow="A.I Do setup"
                  title="Start with the details that unlock everything."
                  description="In a few minutes, A.I Do will shape your dashboard, budget, guest tools, vendor plan, and Aria assistant around your actual wedding. Think of this as setting the table before the planning begins."
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      { icon: ClipboardCheck, title: "Planning hub", text: "Your tasks, budget, guests, and files start from the same source of truth." },
                      { icon: Search, title: "Venue path", text: "Booked or still searching, we capture the right next step without extra setup." },
                      { icon: MessageCircle, title: "Aria context", text: "Your assistant begins with useful details instead of asking you to repeat yourself." },
                    ].map(({ icon: Icon, title, text }) => (
                      <div key={title} className="rounded-3xl border border-[#efd6d9] bg-white/80 p-5 shadow-[0_14px_34px_rgba(94,53,59,0.08)]">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7dde2] text-[#9c3158]">
                          <Icon className="h-5 w-5" />
                        </span>
                        <h3 className="mt-5 font-serif text-2xl text-[#3c252b]">{title}</h3>
                        <p className="mt-2 text-sm leading-6 text-[#835f66]">{text}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <PrimaryButton type="button" onClick={next}>
                      Create my planning hub
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={skipCurrentStep}>I'll skip this for now</SecondaryButton>
                  </div>
                </StepShell>
              )}

              {step === 1 && (
                <StepShell
                  eyebrow="Step 1 of 7"
                  title="Name your wedding workspace."
                  description="Add the names you want A.I Do to use across your dashboard, reminders, guest tools, and Aria planning context."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="partner2Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your first name</FormLabel>
                          <FormControl><Input className="h-14 rounded-2xl border-[#e8cfc5] bg-white text-base" placeholder="e.g. Stacy" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="partner1Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Partner's first name</FormLabel>
                          <FormControl><Input className="h-14 rounded-2xl border-[#e8cfc5] bg-white text-base" placeholder="e.g. Rick" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="sharedLastName"
                    render={({ field }) => (
                      <FormItem className="mt-5">
                        <FormLabel>Shared display last name</FormLabel>
                        <FormControl><Input className="h-14 rounded-2xl border-[#e8cfc5] bg-white text-base" placeholder="Optional, e.g. Rivera" {...field} /></FormControl>
                        <p className="text-sm text-[#835f66]">Optional. If you add it, A.I Do displays your names as a polished couple title.</p>
                      </FormItem>
                    )}
                  />
                </StepShell>
              )}

              {step === 2 && (
                <StepShell
                  eyebrow="Step 2 of 7"
                  title={`Put the big day on the calendar${firstName(values.partner2Name) ? `, ${firstName(values.partner2Name)}` : ""}.`}
                  description="A.I Do uses this date to pace your checklist, payment reminders, day-of timeline, and guest communication."
                >
                  <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr_1fr]">
                    <FormField
                      control={form.control}
                      name="weddingDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Wedding date</FormLabel>
                          <FormControl><Input type="date" className="h-14 rounded-2xl border-[#e8cfc5] bg-white text-base" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ceremonyTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ceremony</FormLabel>
                          <FormControl><Input type="time" className="h-14 rounded-2xl border-[#e8cfc5] bg-white text-base" {...field} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="receptionTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reception</FormLabel>
                          <FormControl><Input type="time" className="h-14 rounded-2xl border-[#e8cfc5] bg-white text-base" {...field} /></FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </StepShell>
              )}

              {step === 3 && (
                <StepShell
                  eyebrow="Step 3 of 7"
                  title="Give the plan its guardrails."
                  description="Budget and guest count are working estimates. They help A.I Do size recommendations, reminders, and vendor priorities without locking you in."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="totalBudget"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total budget</FormLabel>
                          <FormControl>
                            <MoneyInput
                              value={field.value}
                              onValueChange={field.onChange}
                              onBlur={field.onBlur}
                              className="h-14 rounded-2xl border-[#e8cfc5] bg-white text-base"
                            />
                          </FormControl>
                          <p className="text-sm text-[#835f66]">Use your current comfort zone. You can revise it anytime.</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="guestCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estimated guest count</FormLabel>
                          <FormControl><Input type="number" min={1} className="h-14 rounded-2xl border-[#e8cfc5] bg-white text-base" placeholder="e.g. 120" {...field} /></FormControl>
                          <p className="text-sm text-[#835f66]">A rough count is enough for early planning.</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="preferredLanguage"
                    render={({ field }) => (
                      <FormItem className="mt-5">
                        <FormLabel>Preferred language for Aria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-14 rounded-2xl border-[#e8cfc5] bg-white text-base">
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LANGUAGES.map((language) => <SelectItem key={language} value={language}>{language}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </StepShell>
              )}

              {step === 4 && (
                <StepShell
                  eyebrow="Step 4 of 7"
                  title="Set the venue direction."
                  description="Tell A.I Do whether the location is locked, still in progress, or intentionally unconventional. The next questions adapt to your answer."
                >
                  <div className="grid gap-4">
                    <ChoiceCard
                      active={venueChoice === "booked"}
                      title="Venue is booked"
                      description="Add the name and city so your timeline, budget, and reminders can anchor around it."
                      icon={MapPin}
                      onClick={() => form.setValue("venueChoice", "booked", { shouldDirty: true })}
                    />
                    <ChoiceCard
                      active={venueChoice === "looking"}
                      title="Venue search is active"
                      description="Open the discovery flow to organize location, style, must-haves, and outreach notes."
                      icon={Search}
                      onClick={() => form.setValue("venueChoice", "looking", { shouldDirty: true })}
                    />
                    <ChoiceCard
                      active={venueChoice === "non_traditional"}
                      title="Private, pop-up, or non-traditional"
                      description="Capture the area and constraints so Aria can help turn the idea into a workable plan."
                      icon={Sparkles}
                      onClick={() => form.setValue("venueChoice", "non_traditional", { shouldDirty: true })}
                    />
                  </div>

                  {venueChoice === "booked" ? (
                    <div className="mt-6 grid gap-5 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="venue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Venue name</FormLabel>
                            <FormControl><Input className="h-14 rounded-2xl border-[#e8cfc5] bg-white text-base" placeholder="e.g. Chateau LaMer" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City or location</FormLabel>
                            <FormControl><Input className="h-14 rounded-2xl border-[#e8cfc5] bg-white text-base" placeholder="e.g. Austin, TX" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ) : (
                    <div className="mt-6 space-y-5">
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Where are you planning?</FormLabel>
                            <FormControl><Input className="h-14 rounded-2xl border-[#e8cfc5] bg-white text-base" placeholder="e.g. Austin, TX or Hudson Valley, NY" {...field} /></FormControl>
                            <p className="text-sm text-[#835f66]">This gives the venue wizard and Aria a useful search area.</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="venueDiscovery"
                        render={({ field }) => (
                          <FormItem>
                            <VenueWizard
                              value={{
                                ...freshVenueDiscovery(),
                                ...field.value,
                                guestCount: field.value.guestCount || String(normalizeGuests(values.guestCount)),
                                budgetRange: field.value.budgetRange || (normalizeMoney(values.totalBudget) ? `$${normalizeMoney(values.totalBudget).toLocaleString()}` : ""),
                                location: field.value.location || values.location,
                              }}
                              onChange={(nextValue) => field.onChange(nextValue)}
                              coupleNames={coupleNames}
                            />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </StepShell>
              )}

              {step === 5 && (
                <StepShell
                  eyebrow="Step 5 of 7"
                  title="Mark what is already handled."
                  description="Select any vendor categories you have covered. Your checklist will start smarter and Aria will focus on the open decisions."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {VENDOR_OPTIONS.map((vendor) => {
                      const active = bookedVendors.includes(vendor);
                      return (
                        <button
                          key={vendor}
                          type="button"
                          onClick={() => toggleBookedVendor(vendor)}
                          className={`flex min-h-16 items-center gap-4 rounded-2xl border px-5 text-left font-semibold transition-all ${
                            active
                              ? "border-[#9c3158] bg-[#fff7f8] text-[#3c252b] shadow-[0_12px_26px_rgba(156,49,88,0.12)]"
                              : "border-[#ead2ca] bg-white/75 text-[#3c252b] hover:border-[#d4a373]"
                          }`}
                        >
                          <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${active ? "border-[#9c3158] bg-[#9c3158] text-white" : "border-[#e2c9bc] bg-white text-transparent"}`}>
                            <Check className="h-4 w-4" />
                          </span>
                          {vendor}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-5 rounded-3xl border border-[#efd6d9] bg-white/70 p-5">
                    <p className="font-semibold text-[#3c252b]">{bookedVendors.length ? `${bookedVendors.length} categories already covered` : "Starting fresh"}</p>
                    <p className="mt-1 text-sm text-[#835f66]">You can still add full vendor cards later with contracts, payments, contacts, and files.</p>
                  </div>
                </StepShell>
              )}

              {step === 6 && (
                <StepShell
                  eyebrow="Step 6 of 7"
                  title="Bring in your planning partner."
                  description="Send an invite now, or skip it and add collaborators later from Settings. You stay in control of access."
                >
                  <FormField
                    control={form.control}
                    name="partnerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Partner's email address</FormLabel>
                        <FormControl><Input type="email" className="h-14 rounded-2xl border-[#e8cfc5] bg-white text-base" placeholder="partner@example.com" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="mt-6 rounded-3xl border border-[#efd6d9] bg-white/75 p-5">
                    <div className="flex items-start gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f7dde2] text-[#9c3158]">
                        <Mail className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-semibold text-[#3c252b]">Access can grow with the plan.</p>
                        <p className="mt-1 text-sm leading-6 text-[#835f66]">Later, you can invite planners or vendors with role-specific permissions.</p>
                      </div>
                    </div>
                  </div>
                </StepShell>
              )}

              {step === 7 && (
                <StepShell
                  eyebrow="Step 7 of 7"
                  title="Hand the first question to Aria."
                  description="Aria is your A.I Do planning assistant. It can turn your setup into next steps, draft vendor outreach, create tasks, and answer questions with your wedding context in mind."
                >
                  <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#9c3158] text-lg font-bold text-white shadow-[0_14px_30px_rgba(156,49,88,0.2)]">
                      A
                    </div>
                    <div className="rounded-[2rem] border border-[#efd6d9] bg-white/85 p-6 shadow-[0_16px_38px_rgba(94,53,59,0.1)]">
                      <p className="text-lg leading-8 text-[#3c252b]">
                        Hi {coupleNames}. I have your date, budget range, guest estimate, venue direction, and early vendor status.
                      </p>
                      <p className="mt-4 text-lg leading-8 text-[#3c252b]">
                        {venueChoice === "booked"
                          ? `With ${values.venue || "your venue"} in place, I can help keep payments, guests, and timeline details moving.`
                          : "With the venue path still open, I can help compare options, prepare outreach, and turn the search into practical next steps."}
                      </p>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="ariaPrompt"
                    render={({ field }) => (
                      <FormItem className="mt-6">
                        <FormControl>
                          <Textarea
                            className="min-h-24 rounded-3xl border-[#e8cfc5] bg-white p-5 text-base"
                            placeholder="Ask Aria for your first next move, or leave this blank and open the dashboard..."
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <PrimaryButton type="button" disabled={saving} onClick={() => complete({ openAria: Boolean(finalPrompt?.trim()) })}>
                      {saving ? "Saving..." : finalPrompt?.trim() ? "Ask Aria" : "Open my dashboard"}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </PrimaryButton>
                    <SecondaryButton type="button" disabled={saving} onClick={() => complete({ openAria: false })}>
                      I'll skip this for now
                    </SecondaryButton>
                  </div>
                </StepShell>
              )}

              {step > 0 && step < STEPS.length && (
                <div className="mx-auto mt-10 flex w-full max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <SecondaryButton type="button" onClick={back}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </SecondaryButton>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {step < STEPS.length - 1 && (
                      <SecondaryButton type="button" onClick={skipCurrentStep}>
                        I'll skip this for now
                      </SecondaryButton>
                    )}
                    {step < STEPS.length - 1 && (
                      <PrimaryButton type="button" onClick={next}>
                        Continue
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </PrimaryButton>
                    )}
                  </div>
                </div>
              )}
            </form>
              </Form>
            </main>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useOnboardingWizard(hasProfile: boolean) {
  const { user } = useUser();
  const key = user?.id ? `${ONBOARDING_KEY_PREFIX}:${user.id}` : null;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!key) {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(sessionStorage.getItem(key) === "true");
    } catch {
      setDismissed(false);
    }
  }, [key]);

  const shouldShow = !hasProfile && !dismissed;
  return {
    shouldShow,
    dismiss: () => {
      if (key) {
        try {
          sessionStorage.setItem(key, "true");
        } catch {}
      }
      setDismissed(true);
    },
  };
}
