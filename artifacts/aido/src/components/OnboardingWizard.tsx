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
      className={`group flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
        active
          ? "border-[#9c3158] bg-[#fff7f8] shadow-[0_14px_34px_rgba(156,49,88,0.14)]"
          : "border-[#ead2ca] bg-white/80 hover:-translate-y-0.5 hover:border-[#d4a373] hover:shadow-[0_12px_28px_rgba(94,53,59,0.10)]"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
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
    <div className="mx-auto w-full max-w-3xl">
      {eyebrow && <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#9c3158]">{eyebrow}</p>}
      <h2 className="font-serif text-4xl leading-tight text-[#3c252b] sm:text-5xl">{title}</h2>
      {description && <p className="mt-4 max-w-2xl text-lg leading-8 text-[#73565d]">{description}</p>}
      <div className="mt-8">{children}</div>
    </div>
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
      } else if (!String(current.location || current.venueDiscovery.location || "").trim()) {
        form.setError("location", { type: "manual", message: "Add the city or area where you are looking." });
        valid = false;
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
      if (!validateStep(index)) {
        setStep(index);
        return;
      }
    }

    const current = form.getValues();
    const { sharedLastName } = current;
    const venueStatus = current.venueChoice === "booked" ? "booked" : "not_yet";
    const venueDiscovery = venueStatus === "not_yet" ? venueDiscoveryForSave(current) : null;
    const location = current.location || current.venueDiscovery.location || "";
    const prompt = current.ariaPrompt.trim();

    setSaving(true);
    try {
      await saveProfile.mutateAsync({
        data: {
          ...current,
          ...prepareCoupleNames({ ...current, sharedLastName }),
          accountType: "couple_individual",
          venueStatus,
          venueDiscovery: venueDiscovery as Record<string, unknown> | null,
          venueBrainstorm: null,
          planningPriorities: emptyPlanningPriorities,
          venue: venueStatus === "booked" ? current.venue.trim() : "",
          location,
          guestCount: normalizeGuests(current.guestCount),
          totalBudget: normalizeMoney(current.totalBudget),
          weddingVibe: current.weddingVibe.trim() || "Warm, elegant, and organized",
          preferredLanguage: current.preferredLanguage,
        },
      });

      try {
        await maybeInvitePartner(current.partnerEmail);
      } catch (inviteError) {
        toast({
          title: "Profile saved",
          description: inviteError instanceof Error ? inviteError.message : "The partner invite could not be sent yet.",
          variant: "destructive",
        });
      }

      const code = LANG_NAME_TO_CODE[current.preferredLanguage] ?? "en";
      i18n.changeLanguage(code);
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["my-workspaces"] });

      if (user?.id) {
        try {
          sessionStorage.setItem(`${ONBOARDING_KEY_PREFIX}:${user.id}`, "true");
          sessionStorage.removeItem("aido_signup_account_type");
          localStorage.setItem(`aido_language_${user.id}`, code);
          localStorage.setItem(`aido_onboarding_booked_vendors_${user.id}`, JSON.stringify(current.bookedVendors));
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
        className="max-h-[94vh] overflow-hidden border-[#efd6d9] bg-[#fffaf6] p-0 shadow-[0_30px_90px_rgba(74,35,43,0.26)] sm:max-w-[980px]"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>A.I Do wedding setup</DialogTitle>
          <DialogDescription>Set up your wedding workspace and Aria assistant.</DialogDescription>
        </DialogHeader>

        <div className="relative max-h-[94vh] overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(247,221,226,0.85),transparent_34%),linear-gradient(180deg,#fffaf6_0%,#fff6f7_100%)] px-5 py-6 sm:px-10 sm:py-8">
          <div className="pointer-events-none absolute right-8 top-20 h-44 w-44 rounded-full bg-[#f7dde2]/50 blur-3xl" />
          <div className="pointer-events-none absolute bottom-12 left-8 h-36 w-36 rounded-full bg-[#d4a373]/20 blur-3xl" />

          <div className="relative z-10 mb-8 flex items-center gap-2">
            {STEPS.map((label, index) => (
              <div key={label} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eadfda]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    index <= step ? "w-full bg-[#9c3158]" : "w-0 bg-[#9c3158]"
                  }`}
                />
              </div>
            ))}
          </div>

          <Form {...form}>
            <form className="relative z-10" onSubmit={(event) => event.preventDefault()}>
              {step === 0 && (
                <StepShell
                  eyebrow="A.I Do onboarding"
                  title="Wedding planning without the scattered tabs."
                  description="A.I Do keeps your budget, guests, vendors, tasks, documents, and day-of timeline in one calm workspace. Aria uses the details you add here to help you move faster from the first screen."
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      { icon: ClipboardCheck, title: "One plan", text: "Tasks, files, vendors, and budget stay connected." },
                      { icon: Search, title: "Smart discovery", text: "Still looking for a venue? We will start the wizard here." },
                      { icon: MessageCircle, title: "Aria ready", text: "Your assistant starts with real context, not a blank chat." },
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
                      Build my wedding plan
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={dismiss}>Skip setup for now</SecondaryButton>
                  </div>
                </StepShell>
              )}

              {step === 1 && (
                <StepShell
                  eyebrow="Step 1 of 7"
                  title="Who is getting married?"
                  description="First names are enough. We will use these throughout your dashboard, reminders, and Aria's planning context."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="partner2Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your first name</FormLabel>
                          <FormControl><Input className="h-14 rounded-2xl border-[#e8cfc5] bg-white text-base" placeholder="First name" {...field} /></FormControl>
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
                          <FormControl><Input className="h-14 rounded-2xl border-[#e8cfc5] bg-white text-base" placeholder="First name" {...field} /></FormControl>
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
                  title={`When is the wedding, ${firstName(values.partner2Name) || "friend"}?`}
                  description="An exact date is ideal, but a target date works too. Your checklist, reminders, and timeline all build from here."
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
                  title="Set the planning range."
                  description="These estimates help A.I Do size the budget, guest tools, vendor reminders, and timeline. You can adjust them anytime."
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
                          <p className="text-sm text-[#835f66]">A realistic range matters more than a perfect number.</p>
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
                          <p className="text-sm text-[#835f66]">This is a planning number, not a commitment.</p>
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
                  title="Have you booked a venue yet?"
                  description="If you already have one, we will anchor your profile around it. If not, A.I Do will open the Venue Discovery Wizard right here."
                >
                  <div className="grid gap-4">
                    <ChoiceCard
                      active={venueChoice === "booked"}
                      title="Yes, we have a venue"
                      description="Add the name and location so the rest of your plan has a home base."
                      icon={MapPin}
                      onClick={() => form.setValue("venueChoice", "booked", { shouldDirty: true })}
                    />
                    <ChoiceCard
                      active={venueChoice === "looking"}
                      title="We are still looking"
                      description="Use the discovery wizard to define locations, style, must-haves, and outreach drafts."
                      icon={Search}
                      onClick={() => form.setValue("venueChoice", "looking", { shouldDirty: true })}
                    />
                    <ChoiceCard
                      active={venueChoice === "non_traditional"}
                      title="We are doing something non-traditional"
                      description="Great. We will still capture the area, constraints, and planning notes so Aria can guide the next steps."
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
                            <p className="text-sm text-[#835f66]">This feeds venue discovery and local vendor suggestions.</p>
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
                  title="Which vendors have you already booked?"
                  description="Tap anything already handled. A.I Do will use this as launch context so Aria and your checklist focus on what is still open."
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
                    <p className="font-semibold text-[#3c252b]">{bookedVendors.length ? `${bookedVendors.length} booked so far` : "None yet"}</p>
                    <p className="mt-1 text-sm text-[#835f66]">You can still add full vendor cards later with contracts, payments, contacts, and files.</p>
                  </div>
                </StepShell>
              )}

              {step === 6 && (
                <StepShell
                  eyebrow="Step 6 of 7"
                  title="Invite your partner when you are ready."
                  description="They will get full access to view, edit, and manage the wedding workspace with you. This can be skipped and done later from Settings."
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
                        <p className="font-semibold text-[#3c252b]">Collaboration stays flexible.</p>
                        <p className="mt-1 text-sm leading-6 text-[#835f66]">You can also invite planners or vendors later with more limited permissions.</p>
                      </div>
                    </div>
                  </div>
                </StepShell>
              )}

              {step === 7 && (
                <StepShell
                  eyebrow="Step 7 of 7"
                  title="One more thing before you dive in."
                  description="Meet Aria, your A.I Do planning assistant. Aria can answer questions, create tasks, draft vendor emails, update details, and use the context you just added."
                >
                  <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#9c3158] text-lg font-bold text-white shadow-[0_14px_30px_rgba(156,49,88,0.2)]">
                      A
                    </div>
                    <div className="rounded-[2rem] border border-[#efd6d9] bg-white/85 p-6 shadow-[0_16px_38px_rgba(94,53,59,0.1)]">
                      <p className="text-lg leading-8 text-[#3c252b]">
                        Hi {coupleNames}. I can see your wedding date, budget, guest estimate, venue status, and which vendors you have already handled.
                      </p>
                      <p className="mt-4 text-lg leading-8 text-[#3c252b]">
                        {venueChoice === "booked"
                          ? `Since ${values.venue || "your venue"} is booked, I will help keep payments, guests, and timeline details moving.`
                          : "Since you are still shaping the venue plan, I can help compare locations, draft outreach, and turn the search into clear next steps."}
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
                            placeholder="Ask Aria anything, or leave this blank and head to your dashboard..."
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <PrimaryButton type="button" disabled={saving} onClick={() => complete({ openAria: Boolean(finalPrompt?.trim()) })}>
                      {saving ? "Saving..." : finalPrompt?.trim() ? "Ask Aria" : "Go to my dashboard"}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </PrimaryButton>
                    <SecondaryButton type="button" disabled={saving} onClick={() => complete({ openAria: false })}>
                      Go to dashboard
                    </SecondaryButton>
                  </div>
                </StepShell>
              )}

              {step > 0 && step < STEPS.length && (
                <div className="mx-auto mt-10 flex w-full max-w-3xl items-center justify-between gap-3">
                  <SecondaryButton type="button" onClick={back}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </SecondaryButton>
                  {step < STEPS.length - 1 && (
                    <PrimaryButton type="button" onClick={next}>
                      Continue
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </PrimaryButton>
                  )}
                </div>
              )}
            </form>
          </Form>
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
