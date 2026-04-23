import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSaveProfile, getGetProfileQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Calendar, MapPin, Users, DollarSign, Sparkles, ArrowRight, Check, Globe } from "lucide-react";

const ONBOARDING_KEY = "aido_onboarding_done";

const VIBES = [
  "Romantic & Classic",
  "Rustic & Bohemian",
  "Modern & Minimalist",
  "Glamorous & Luxurious",
  "Outdoor & Garden",
  "Destination Wedding",
  "Intimate & Cozy",
  "Cultural & Traditional",
];

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Chinese (Simplified)", "Japanese", "Korean", "Arabic", "Hindi",
  "Russian", "Dutch", "Polish",
];

const schema = z.object({
  partner1Name: z.string().min(1, "Required"),
  partner2Name: z.string().min(1, "Required"),
  weddingDate: z.string().min(1, "Required"),
  ceremonyTime: z.string().min(1, "Required"),
  receptionTime: z.string().min(1, "Required"),
  venue: z.string().min(1, "Required"),
  location: z.string().min(1, "Required"),
  guestCount: z.coerce.number().min(1, "Must be at least 1"),
  totalBudget: z.coerce.number().min(0, "Must be 0 or more"),
  weddingVibe: z.string().min(1, "Required"),
  preferredLanguage: z.string().default("English"),
});

type WizardValues = z.infer<typeof schema>;

const STEPS = [
  { id: 1, title: "Welcome to A.IDO", icon: Heart, description: "Let's start with the happy couple." },
  { id: 2, title: "The Big Day", icon: Calendar, description: "When and where is it happening?" },
  { id: 3, title: "The Details", icon: Sparkles, description: "Tell us a little more." },
];

export function OnboardingWizard({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  const [step, setStep] = useState(1);
  const queryClient = useQueryClient();
  const saveProfile = useSaveProfile();

  const form = useForm<WizardValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      partner1Name: "",
      partner2Name: "",
      weddingDate: "",
      ceremonyTime: "16:00",
      receptionTime: "18:00",
      venue: "",
      location: "",
      guestCount: 100,
      totalBudget: 20000,
      weddingVibe: "",
      preferredLanguage: "English",
    },
    mode: "onChange",
  });

  function dismiss() {
    localStorage.setItem(ONBOARDING_KEY, "true");
    onDismiss();
  }

  async function handleNext() {
    let fields: (keyof WizardValues)[] = [];
    if (step === 1) fields = ["partner1Name", "partner2Name"];
    if (step === 2) fields = ["weddingDate", "ceremonyTime", "receptionTime", "venue", "location"];
    const valid = await form.trigger(fields);
    if (!valid) return;
    if (step < 3) {
      setStep(s => s + 1);
    }
  }

  function handleSubmit(values: WizardValues) {
    saveProfile.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        localStorage.setItem(ONBOARDING_KEY, "true");
        onDismiss();
      },
    });
  }

  const currentStep = STEPS[step - 1];
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
              <DialogTitle className="font-serif text-xl text-primary">{currentStep.title}</DialogTitle>
              <DialogDescription className="text-sm">{currentStep.description}</DialogDescription>
            </div>
          </div>
          {/* Progress dots */}
          <div className="flex items-center gap-2 mt-3">
            {STEPS.map(s => (
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
                  <p className="text-sm text-muted-foreground">Who's getting married?</p>
                </div>
                <FormField control={form.control} name="partner1Name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Partner 1 Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Emma" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="partner2Name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Partner 2 Name</FormLabel>
                    <FormControl><Input placeholder="e.g. James" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="button" className="w-full mt-2" onClick={handleNext}>
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <FormField control={form.control} name="weddingDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel><Calendar className="h-3.5 w-3.5 inline mr-1" />Wedding Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="ceremonyTime" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ceremony Time</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="receptionTime" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reception Time</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="venue" render={({ field }) => (
                  <FormItem>
                    <FormLabel><MapPin className="h-3.5 w-3.5 inline mr-1" />Venue Name</FormLabel>
                    <FormControl><Input placeholder="e.g. The Grand Ballroom" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>City / Location</FormLabel>
                    <FormControl><Input placeholder="e.g. New York, NY" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-2 mt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                  <Button type="button" className="flex-1" onClick={handleNext}>Next <ArrowRight className="h-4 w-4 ml-2" /></Button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="guestCount" render={({ field }) => (
                    <FormItem>
                      <FormLabel><Users className="h-3.5 w-3.5 inline mr-1" />Guest Count</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="totalBudget" render={({ field }) => (
                    <FormItem>
                      <FormLabel><DollarSign className="h-3.5 w-3.5 inline mr-1" />Total Budget</FormLabel>
                      <FormControl>
                        <MoneyInput
                          value={field.value}
                          onValueChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="weddingVibe" render={({ field }) => (
                  <FormItem>
                    <FormLabel><Sparkles className="h-3.5 w-3.5 inline mr-1" />Wedding Vibe</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Pick your style" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {VIBES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="preferredLanguage" render={({ field }) => (
                  <FormItem>
                    <FormLabel><Globe className="h-3.5 w-3.5 inline mr-1" />Preferred Language</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LANGUAGES.map(lang => <SelectItem key={lang} value={lang}>{lang}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">AI features like Aria and vendor emails will respond in this language.</p>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-2 mt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
                  <Button type="submit" className="flex-1" disabled={saveProfile.isPending}>
                    {saveProfile.isPending ? "Setting up…" : <>
                      <Check className="h-4 w-4 mr-2" /> Let's Plan!
                    </>}
                  </Button>
                </div>
                {saveProfile.isError && (
                  <p className="text-sm text-destructive text-center">Something went wrong. Please try again.</p>
                )}
              </>
            )}
          </form>
        </Form>

        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-xs text-muted-foreground hover:text-foreground underline"
        >
          Skip for now
        </button>
      </DialogContent>
    </Dialog>
  );
}

export function useOnboardingWizard(hasProfile: boolean) {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(ONBOARDING_KEY) === "true";
  });
  const shouldShow = !hasProfile && !dismissed;
  return {
    shouldShow,
    dismiss: () => setDismissed(true),
  };
}
