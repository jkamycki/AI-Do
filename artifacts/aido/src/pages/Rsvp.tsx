import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Heart, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

const schema = z.object({
  attendance: z.enum(["attending", "declined"], { required_error: "Please select Accept or Decline." }),
  mealChoice: z.string().optional(),
  plusOne: z.boolean().default(false),
  plusOneName: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const MEAL_OPTIONS = [
  { value: "chicken", label: "Chicken" },
  { value: "beef", label: "Beef" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "fish", label: "Fish" },
  { value: "kids", label: "Kids Meal" },
];

function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="A.IDO — AI Wedding Planning OS"
      className={className ?? "h-16 w-auto object-contain"}
    />
  );
}

interface RsvpInfo {
  guestName: string;
  partner1Name: string | null;
  partner2Name: string | null;
  weddingDate: string | null;
  venue: string | null;
  currentStatus: string;
}

export default function Rsvp() {
  const [, params] = useRoute("/rsvp/:token");
  const token = params?.token ?? "";
  const [submitted, setSubmitted] = useState(false);
  const [finalStatus, setFinalStatus] = useState<"attending" | "declined" | null>(null);

  const { data: info, isLoading, isError } = useQuery({
    queryKey: ["rsvp", token],
    queryFn: async () => {
      const res = await fetch(`/api/rsvp/${token}`);
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
    },
  });

  const attendance = form.watch("attendance");
  const plusOne = form.watch("plusOne");

  const submit = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch(`/api/rsvp/${token}`, {
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
    },
  });

  const couple = [info?.partner1Name, info?.partner2Name].filter(Boolean).join(" & ") || "The Couple";

  const weddingDateStr = info?.weddingDate
    ? new Date(info.weddingDate).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      })
    : null;

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
        <div className="mb-6"><Logo className="h-20 w-auto object-contain" /></div>
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
        <div className="mb-8"><Logo className="h-20 w-auto object-contain" /></div>
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
        <p className="mt-6 text-xs text-white/40">Powered by A.IDO — AI Wedding Planning OS</p>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[hsl(270,20%,10%)]"
      style={{ backgroundImage: "radial-gradient(hsl(40 82% 42% / 0.07) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>

      <div className="w-full py-4 px-6 flex items-center justify-center border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <Logo className="h-24 w-auto object-contain" />
      </div>

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
            </div>
          </div>

          <Card className="shadow-2xl border-white/10 bg-white/5 overflow-hidden">
            <div className="h-1.5 w-full bg-primary" />
            <CardContent className="pt-7 pb-8 px-6 sm:px-8 space-y-6">

              <p className="text-sm text-white/70 text-center">
                Dear <span className="text-white font-semibold">{info.guestName}</span>, will you be joining us?
              </p>

              <Form {...form}>
                <form onSubmit={form.handleSubmit((d) => submit.mutate(d))} className="space-y-6">

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
                            <FormLabel className="text-white/80">Meal Selection</FormLabel>
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
                          <FormField
                            control={form.control}
                            name="plusOneName"
                            render={({ field }) => (
                              <FormItem className="animate-in fade-in slide-in-from-top-1 duration-150">
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
                        )}
                      </div>
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

          <p className="text-center text-xs text-white/40 pb-6">
            Powered by <span className="font-medium text-primary">A.IDO</span> — AI Wedding Planning OS
          </p>
        </div>
      </div>
    </div>
  );
}
