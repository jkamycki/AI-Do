import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSaveProfile, getGetProfileQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Calendar, MapPin, Users, DollarSign, Sparkles, ArrowRight, Check, Globe } from "lucide-react";
import i18n, { LANG_NAME_TO_CODE } from "@/i18n";

const ONBOARDING_KEY_PREFIX = "aido_onboarding_dismissed";

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Chinese (Simplified)", "Japanese", "Korean", "Arabic", "Hindi",
  "Russian", "Dutch", "Polish",
];

const schema = z.object({
  accountType: z.literal("couple_individual").default("couple_individual"),
  partner1Name: z.string().default(""),
  partner2Name: z.string().default(""),
  weddingDate: z.string().default(""),
  ceremonyTime: z.string().default("16:00"),
  receptionTime: z.string().default("18:00"),
  venue: z.string().default(""),
  location: z.string().default(""),
  guestCount: z.coerce.number().min(1, "Must be at least 1"),
  totalBudget: z.coerce.number().min(0, "Must be 0 or more"),
  weddingVibe: z.string().default("Not set"),
  preferredLanguage: z.string().default("English"),
}).superRefine((values, ctx) => {
  for (const field of ["partner1Name", "partner2Name", "weddingDate", "ceremonyTime", "receptionTime", "venue", "location"] as const) {
    if (!String(values[field] ?? "").trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: "Required" });
    }
  }
});

type WizardValues = z.infer<typeof schema>;

const STEP_DEFS = [
  { id: 1, icon: Heart, titleKey: "onboarding.step1_title", titleDefault: "Welcome to A.IDO", descKey: "onboarding.step1_desc", descDefault: "Let's start with the happy couple." },
  { id: 2, icon: Calendar, titleKey: "onboarding.step2_title", titleDefault: "The Big Day", descKey: "onboarding.step2_desc", descDefault: "When and where is it happening?" },
  { id: 3, icon: Sparkles, titleKey: "onboarding.step3_title", titleDefault: "The Details", descKey: "onboarding.step3_desc", descDefault: "Tell us a little more." },
];

export function OnboardingWizard({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  const { t } = useTranslation();
  const { user } = useUser();
  const [step, setStep] = useState(1);
  const queryClient = useQueryClient();
  const saveProfile = useSaveProfile();

  const form = useForm<WizardValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountType: "couple_individual",
      partner1Name: "",
      partner2Name: "",
      weddingDate: "",
      ceremonyTime: "16:00",
      receptionTime: "18:00",
      venue: "",
      location: "",
      guestCount: 100,
      totalBudget: 20000,
      weddingVibe: "Not set",
      preferredLanguage: "English",
    },
    mode: "onChange",
  });

  function dismiss() {
    if (user?.id) {
      try {
        sessionStorage.setItem(`${ONBOARDING_KEY_PREFIX}:${user.id}`, "true");
      } catch {}
    }
    onDismiss();
  }

  async function handleNext() {
    let fields: (keyof WizardValues)[] = [];
    if (step === 1) fields = ["partner1Name", "partner2Name"];
    if (step === 2) fields = ["weddingDate", "ceremonyTime", "receptionTime", "venue", "location"];
    const valid = fields.length === 0 ? true : await form.trigger(fields);
    if (!valid) return;
    if (step < 3) setStep(s => s + 1);
  }

  function handleSubmit(values: WizardValues) {
    saveProfile.mutate({ data: { ...values, accountType: "couple_individual" } }, {
      onSuccess: () => {
        const code = LANG_NAME_TO_CODE[values.preferredLanguage] ?? "en";
        i18n.changeLanguage(code);
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["my-workspaces"] });
        if (user?.id) {
          try {
            sessionStorage.setItem(`${ONBOARDING_KEY_PREFIX}:${user.id}`, "true");
            sessionStorage.removeItem("aido_signup_account_type");
            localStorage.setItem(`aido_language_${user.id}`, code);
          } catch {}
        }
        onDismiss();
      },
    });
  }

  const currentStep = STEP_DEFS[step - 1];
  const Icon = currentStep.icon;

  return (
    <Dialog open={open} onOpenChange={open => !open && dismiss()}>
      <DialogContent className="sm:max-w-[480px]" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="font-serif text-xl text-primary">{t(currentStep.titleKey, { defaultValue: currentStep.titleDefault })}</DialogTitle>
              <DialogDescription className="text-sm">{t(currentStep.descKey, { defaultValue: currentStep.descDefault })}</DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            {STEP_DEFS.map(s => (
              <div
                key={s.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s.id < step ? "bg-primary w-6" : s.id === step ? "bg-primary w-10" : "bg-primary/20 w-6"
                }`}
              />
            ))}
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
            {step === 1 && (
              <>
                <div className="text-center py-2">
                  <div className="text-3xl mb-2">💍</div>
                  <p className="text-sm text-muted-foreground">
                    {t("onboarding.who_getting_married", { defaultValue: "Who's getting married?" })}
                  </p>
                </div>
                <FormField control={form.control} name="partner2Name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bride's Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Sophia" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="partner1Name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Groom's Name</FormLabel>
                    <FormControl><Input placeholder="e.g. James" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="button" className="w-full mt-2" onClick={handleNext}>
                  {t("onboarding.next", { defaultValue: "Next" })} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <FormField control={form.control} name="weddingDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel><Calendar className="h-3.5 w-3.5 inline mr-1" />{t("onboarding.wedding_date", { defaultValue: "Wedding Date" })}</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="ceremonyTime" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("onboarding.ceremony_time", { defaultValue: "Ceremony Time" })}</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="receptionTime" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("onboarding.reception_time", { defaultValue: "Reception Time" })}</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="venue" render={({ field }) => (
                  <FormItem>
                    <FormLabel><MapPin className="h-3.5 w-3.5 inline mr-1" />{t("onboarding.venue_name", { defaultValue: "Venue Name" })}</FormLabel>
                    <FormControl><Input placeholder={t("onboarding.venue_placeholder", { defaultValue: "e.g. The Grand Ballroom" })} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("onboarding.city_location", { defaultValue: "City / Location" })}</FormLabel>
                    <FormControl>
                      <AddressAutocomplete
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onSelect={(s) => {
                          const composed = [s.city, s.state].filter(Boolean).join(", ");
                          field.onChange(composed || s.street);
                        }}
                        placeholder={t("onboarding.city_placeholder", { defaultValue: "e.g. New York, NY" })}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-2 mt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>{t("onboarding.back", { defaultValue: "Back" })}</Button>
                  <Button type="button" className="flex-1" onClick={handleNext}>{t("onboarding.next", { defaultValue: "Next" })} <ArrowRight className="h-4 w-4 ml-2" /></Button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="guestCount" render={({ field }) => (
                    <FormItem>
                      <FormLabel><Users className="h-3.5 w-3.5 inline mr-1" />{t("onboarding.guest_count", { defaultValue: "Guest Count" })}</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="totalBudget" render={({ field }) => (
                    <FormItem>
                      <FormLabel><DollarSign className="h-3.5 w-3.5 inline mr-1" />{t("onboarding.total_budget", { defaultValue: "Total Budget" })}</FormLabel>
                      <FormControl>
                        <MoneyInput value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="preferredLanguage" render={({ field }) => (
                  <FormItem>
                    <FormLabel><Globe className="h-3.5 w-3.5 inline mr-1" />{t("onboarding.preferred_language", { defaultValue: "Preferred Language" })}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder={t("onboarding.select_language", { defaultValue: "Select language" })} /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LANGUAGES.map(lang => <SelectItem key={lang} value={lang}>{lang}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("onboarding.language_hint", { defaultValue: "AI features like Aria and vendor emails will respond in this language." })}</p>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-2 mt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>{t("onboarding.back", { defaultValue: "Back" })}</Button>
                  <Button type="submit" className="flex-1" disabled={saveProfile.isPending}>
                    {saveProfile.isPending ? t("onboarding.setting_up", { defaultValue: "Setting up..." }) : <>
                      <Check className="h-4 w-4 mr-2" /> {t("onboarding.lets_plan", { defaultValue: "Let's Plan!" })}
                    </>}
                  </Button>
                </div>
                {saveProfile.isError && (
                  <p className="text-sm text-destructive text-center">{t("onboarding.something_wrong", { defaultValue: "Something went wrong. Please try again." })}</p>
                )}
              </>
            )}
          </form>
        </Form>

        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-xs text-muted-foreground hover:text-foreground underline"
        >
          {t("onboarding.skip_for_now", { defaultValue: "Skip for now" })}
        </button>
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
