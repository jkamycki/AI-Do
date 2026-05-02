import { useState } from "react";
import { apiFetch } from "@/lib/authFetch";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Heart, CheckCircle2, XCircle, AlertCircle, Loader2, User } from "lucide-react";

const schema = z.object({
  attendance: z.enum(["attending", "declined"], { required_error: "Please select Accept or Decline." }),
  mealChoice: z.string().optional(),
  plusOne: z.boolean().default(false),
  plusOneName: z.string().optional(),
  plusOneMealChoice: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const MEAL_OPTIONS = [
  { value: "chicken", label: "Chicken" },
  { value: "steak", label: "Steak" },
  { value: "fish", label: "Fish" },
];

interface RsvpInfo {
  guestName: string;
  partner1Name: string | null;
  partner2Name: string | null;
  weddingDate: string | null;
  venue: string | null;
  currentStatus: string;
  hasPhoto: boolean;
  invitationMessage: string | null;
}

export default function Rsvp() {
  const [, params] = useRoute("/rsvp/:token");
  const token = params?.token ?? "";
  const [submitted, setSubmitted] = useState(false);
  const [finalStatus, setFinalStatus] = useState<"attending" | "declined" | null>(null);
  const [pendingData, setPendingData] = useState<FormData | null>(null);

  const { data: info, isLoading, isError } = useQuery({
    queryKey: ["rsvp", token],
    queryFn: async () => {
      const res = await apiFetch(`/api/rsvp/${token}`);
      if (!res.ok) throw new Error("Invalid link");
      return res.json() as Promise<RsvpInfo>;
    },
    enabled: !!token,
    retry: false,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      attendance: undefined,
      mealChoice: "",
      plusOne: false,
      plusOneName: "",
      plusOneMealChoice: "",
      dietaryRestrictions: "",
    },
  });

  const attendance = form.watch("attendance");
  const plusOne = form.watch("plusOne");

  const submit = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiFetch(`/api/rsvp/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Something went wrong. Please try again.");
      }
      return res.json() as Promise<{ success: boolean; status: string }>;
    },
    onSuccess: (data) => {
      setFinalStatus(data.status as "attending" | "declined");
      setSubmitted(true);
      setPendingData(null);
    },
  });

  const couple = [info?.partner1Name, info?.partner2Name].filter(Boolean).join(" & ") || "The Couple";

  const weddingDateStr = info?.weddingDate
    ? (() => {
        const [y, m, d] = info.weddingDate.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        });
      })()
    : null;

  const mealLabel = (val?: string) => MEAL_OPTIONS.find(o => o.value === val)?.label ?? val ?? "—";

  if (isLoading) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-[hsl(270,20%,10%)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !info) {
    return (
      <div className="dark min-h-screen flex flex-col items-center justify-center p-4 bg-[hsl(270,20%,10%)]">
        <Card className="max-w-md w-full text-center shadow-xl border-white/10 bg-white/5">
          <CardContent className="pt-10 pb-8 space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold text-white">This RSVP link is no longer valid</h2>
            <p className="text-white/60 text-sm">The link may have expired or already been used. Please contact the couple directly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    const accepted = finalStatus === "attending";
    return (
      <div className="dark min-h-screen flex flex-col items-center justify-center p-4 bg-[hsl(270,20%,10%)]"
        style={{ backgroundImage: "radial-gradient(hsl(40 82% 42% / 0.07) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
        <Card className="max-w-md w-full text-center shadow-2xl border-white/10 bg-white/5 overflow-hidden">
          <div className="h-1.5 w-full" style={{ background: accepted ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#ef4444,#dc2626)" }} />
          <CardContent className="pt-10 pb-10 space-y-5 px-8">
            <div className="flex justify-center">
              <div className={`h-20 w-20 rounded-full flex items-center justify-center ring-1 ${accepted ? "bg-emerald-500/15 ring-emerald-500/30" : "bg-red-500/15 ring-red-500/30"}`}>
                {accepted
                  ? <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  : <XCircle className="h-10 w-10 text-red-400" />
                }
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "Georgia, serif" }}>
                {accepted ? "See you there!" : "We'll miss you!"}
              </h2>
              <p className="text-white/60 text-sm leading-relaxed">
                {accepted
                  ? <>Thanks, <span className="text-white font-semibold">{info.guestName}</span>! Your attendance has been confirmed for <span className="text-white font-semibold">{couple}'s</span> wedding.</>
                  : <>Thanks for letting us know, <span className="text-white font-semibold">{info.guestName}</span>. <span className="text-white font-semibold">{couple}</span> appreciate you responding.</>
                }
              </p>
              {accepted && weddingDateStr && (
                <p className="text-white/40 text-xs mt-3">{weddingDateStr}{info.venue ? ` · ${info.venue}` : ""}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[hsl(270,20%,10%)]"
      style={{ backgroundImage: "radial-gradient(hsl(40 82% 42% / 0.07) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>

      <div className="w-full flex justify-center pt-6 px-4">
        <img
          src="/logo.png"
          alt="A.IDO"
          className="h-16 sm:h-20 w-auto object-contain"
        />
      </div>

      {info.hasPhoto && (
        <div className="w-full flex justify-center pt-6 px-4">
          <img
            src={`/api/rsvp/${token}/photo`}
            alt={`${couple}'s wedding`}
            className="w-full max-w-md h-auto block rounded-lg"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col items-center py-10 px-4">
        <div className="max-w-lg w-full space-y-6">

          <div className="text-center space-y-4 py-4">
            <div className="flex justify-center mb-2">
              <div className="h-16 w-16 rounded-full flex items-center justify-center shadow-md bg-primary/15 ring-1 ring-primary/30">
                <Heart className="h-8 w-8 fill-primary text-primary" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-widest mb-2 text-primary">
                Wedding RSVP
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight" style={{ fontFamily: "Georgia, serif" }}>
                {couple}
              </h1>
              {weddingDateStr && (
                <p className="text-base text-white/60 mt-1">{weddingDateStr}</p>
              )}
              {info.venue && (
                <p className="text-sm text-white/40 mt-0.5">{info.venue}</p>
              )}
              {info.invitationMessage && (
                <p className="text-sm text-white/70 mt-4 leading-relaxed max-w-md mx-auto italic">
                  "{info.invitationMessage}"
                </p>
              )}
            </div>
          </div>

          <Card className="shadow-2xl border-white/10 bg-white/5 overflow-hidden">
            <div className="h-1.5 w-full bg-primary" />
            <CardContent className="pt-7 pb-8 px-6 sm:px-8 space-y-6">

              <p className="text-sm text-white/70 text-center">
                Dear <span className="text-white font-semibold">{info.guestName}</span>, will you be joining us?
              </p>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((d) => setPendingData(d))}
                  className="space-y-6"
                >

                  <FormField
                    control={form.control}
                    name="attendance"
                    render={({ field }) => (
                      <FormItem>
                        <FormMessage className="text-center" />
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => field.onChange("attending")}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                              field.value === "attending"
                                ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                                : "border-white/15 bg-white/5 text-white/60 hover:border-white/30 hover:bg-white/8"
                            }`}
                          >
                            <CheckCircle2 className={`h-7 w-7 ${field.value === "attending" ? "text-emerald-400" : "text-white/40"}`} />
                            <span className="font-semibold text-sm">Joyfully Accepts</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => field.onChange("declined")}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                              field.value === "declined"
                                ? "border-red-500 bg-red-500/15 text-red-300"
                                : "border-white/15 bg-white/5 text-white/60 hover:border-white/30 hover:bg-white/8"
                            }`}
                          >
                            <XCircle className={`h-7 w-7 ${field.value === "declined" ? "text-red-400" : "text-white/40"}`} />
                            <span className="font-semibold text-sm">Declines with Regrets</span>
                          </button>
                        </div>
                      </FormItem>
                    )}
                  />

                  {attendance === "attending" && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">

                      <FormField
                        control={form.control}
                        name="mealChoice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/80 flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-white/50" />
                              Your Meal Selection
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-white/10 border-white/15 text-white">
                                  <SelectValue placeholder="Select a meal" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {MEAL_OPTIONS.map(o => (
                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                        <FormField
                          control={form.control}
                          name="plusOne"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-3">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="border-white/30 data-[state=checked]:bg-primary"
                                />
                              </FormControl>
                              <div>
                                <FormLabel className="text-white/90 cursor-pointer">Bringing a guest?</FormLabel>
                                <p className="text-xs text-white/50 mt-0.5">Check if someone will be joining you</p>
                              </div>
                            </FormItem>
                          )}
                        />

                        {plusOne && (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
                            <FormField
                              control={form.control}
                              name="plusOneName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-white/80">Plus-one name</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Guest's full name"
                                      className="bg-white/10 border-white/15 text-white placeholder:text-white/30 focus:border-primary"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="plusOneMealChoice"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-white/80 flex items-center gap-2">
                                    <User className="h-3.5 w-3.5 text-white/50" />
                                    Plus-one Meal Selection
                                  </FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="bg-white/10 border-white/15 text-white">
                                        <SelectValue placeholder="Select a meal for your guest" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {MEAL_OPTIONS.map(o => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </div>

                      <FormField
                        control={form.control}
                        name="dietaryRestrictions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/80">
                              Dietary Restrictions / Additional Notes
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="e.g. vegetarian, gluten-free, nut allergy — leave blank if none"
                                className="bg-white/10 border-white/15 text-white placeholder:text-white/30 focus:border-primary resize-none min-h-[80px]"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                    </div>
                  )}

                  {submit.isError && (
                    <p className="text-sm text-red-400 text-center">
                      {submit.error instanceof Error ? submit.error.message : "Something went wrong."}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full font-semibold py-5 rounded-xl"
                    disabled={submit.isPending || !attendance}
                    size="lg"
                  >
                    {submit.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                    ) : (
                      <><Heart className="h-4 w-4 mr-2 fill-current" /> Submit RSVP</>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

        </div>
      </div>

      <AlertDialog open={!!pendingData} onOpenChange={(open) => { if (!open) setPendingData(null); }}>
        <AlertDialogContent className="dark bg-[hsl(270,20%,12%)] border-white/10 text-white max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-center text-xl" style={{ fontFamily: "Georgia, serif" }}>
              Confirm Your RSVP
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-white/70 text-sm text-center">
                <p>
                  Please review your details before sending your RSVP to{" "}
                  <span className="text-white font-semibold">{couple}</span>.
                </p>
                {pendingData && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-left space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/50">Guest</span>
                      <span className="text-white font-medium">{info?.guestName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Response</span>
                      <span className={`font-medium ${pendingData.attendance === "attending" ? "text-emerald-400" : "text-red-400"}`}>
                        {pendingData.attendance === "attending" ? "Joyfully Accepts" : "Declines with Regrets"}
                      </span>
                    </div>
                    {pendingData.attendance === "attending" && pendingData.mealChoice && (
                      <div className="flex justify-between">
                        <span className="text-white/50">Your Meal</span>
                        <span className="text-white font-medium">{mealLabel(pendingData.mealChoice)}</span>
                      </div>
                    )}
                    {pendingData.plusOne && pendingData.plusOneName && (
                      <div className="flex justify-between">
                        <span className="text-white/50">Plus-one</span>
                        <span className="text-white font-medium">{pendingData.plusOneName}</span>
                      </div>
                    )}
                    {pendingData.plusOne && pendingData.plusOneMealChoice && (
                      <div className="flex justify-between">
                        <span className="text-white/50">Their Meal</span>
                        <span className="text-white font-medium">{mealLabel(pendingData.plusOneMealChoice)}</span>
                      </div>
                    )}
                    {pendingData.dietaryRestrictions && (
                      <div className="flex flex-col gap-0.5 pt-1 border-t border-white/10 mt-1">
                        <span className="text-white/50">Dietary / Notes</span>
                        <span className="text-white font-medium">{pendingData.dietaryRestrictions}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel
              className="border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setPendingData(null)}
            >
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => { if (pendingData) submit.mutate(pendingData); }}
              disabled={submit.isPending}
            >
              {submit.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sending...</>
              ) : (
                <><Heart className="h-4 w-4 mr-1.5 fill-current" /> Confirm & Send</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
