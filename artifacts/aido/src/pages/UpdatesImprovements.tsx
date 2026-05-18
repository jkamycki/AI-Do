import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "wouter";
import { CheckCircle2, Clock3, Lightbulb, Send, Sparkles, Wrench, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type UpdateType = "Feature" | "Improvement" | "Fix" | "Coming Soon";

type ProductUpdate = {
  type: UpdateType;
  text: string;
};

export const updatesByMonth: Record<string, ProductUpdate[]> = {
  "May 2026": [
    { type: "Feature", text: "Added Document Library to upload, preview, organize, tag, and manage wedding documents." },
    { type: "Feature", text: "Added AI document summaries and extraction for vendor names, payment schedules, due dates, cancellation policies, deliverables, and contact details." },
    { type: "Feature", text: "Added task creation from documents, so important payments and deadlines can be added to the Checklist." },
    { type: "Improvement", text: "Added Contract Analyzer sync, letting users copy analyzed contracts into the Document Library with confirmation." },
    { type: "Improvement", text: "Added custom folders, tags, color-coded tags, and rename tools for cleaner document organization." },
    { type: "Feature", text: "Added Vendor Contacts with optional vendor autofill and mobile-only Call/Text actions." },
  ],
  "April 2026": [
    { type: "Feature", text: "Mood board builder launched." },
    { type: "Improvement", text: "Cleaner dashboard layout." },
    { type: "Fix", text: "Checklist items not saving for some users." },
    { type: "Coming Soon", text: "Seating chart generator." },
  ],
  "March 2026": [
    { type: "Feature", text: "Guest website themes added." },
    { type: "Improvement", text: "Faster loading times." },
    { type: "Fix", text: "Timeline export bug fixed." },
    { type: "Coming Soon", text: "Budget manager enhancements." },
  ],
};

const typeStyles: Record<UpdateType, { className: string; icon: typeof Sparkles }> = {
  Feature: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: Sparkles,
  },
  Improvement: {
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: Wrench,
  },
  Fix: {
    className: "border-red-200 bg-red-50 text-red-700",
    icon: Zap,
  },
  "Coming Soon": {
    className: "border-purple-200 bg-purple-50 text-purple-700",
    icon: Clock3,
  },
};

const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

function monthTime(label: string) {
  const time = new Date(`${label} 1, 00:00:00`).getTime();
  return Number.isFinite(time) ? time : 0;
}

export default function UpdatesImprovements() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const months = useMemo(
    () => Object.entries(updatesByMonth).sort(([a], [b]) => monthTime(b) - monthTime(a)),
    [],
  );

  async function submitSuggestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !suggestion.trim()) {
      toast({
        title: "Suggestion needs a little more detail",
        description: "Please add your name, email, and suggestion before sending.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API}/api/help/suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          source: "Updates & Improvements suggestion",
          message: suggestion.trim(),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Could not send your suggestion.");
      }
      setSubmitted(true);
      setName("");
      setEmail("");
      setSuggestion("");
      toast({
        title: "Suggestion sent",
        description: "Suggestions go straight to the A.IDO Team. We Appreciate your feedback!",
      });
    } catch (error) {
      toast({
        title: "Could not send suggestion",
        description: error instanceof Error ? error.message : "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-[#2F2430]">
      <section className="border-b border-slate-200 bg-white px-5 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-5xl">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#8D294D] underline-offset-4 hover:underline">
            A.IDO
          </Link>
          <div className="mt-8 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#B16C8E]">Help & Support</p>
            <h1 className="mt-3 font-serif text-4xl font-bold leading-tight text-[#24171D] sm:text-5xl">
              Updates & Improvements
            </h1>
            <p className="mt-4 text-base leading-7 text-[#5F4A55] sm:text-lg">
              See what is new, what improved, what was fixed, and what is coming soon in A.IDO.
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 sm:py-12">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="rounded-2xl border border-slate-200 bg-white">
            {months.map(([month, updates], index) => (
              <section
                key={month}
                className={cn("px-5 py-6 sm:px-7", index > 0 && "border-t border-slate-200")}
              >
                <h2 className="font-serif text-2xl font-bold text-[#24171D]">{month}</h2>
                <ul className="mt-5 space-y-3">
                  {updates.map((update, updateIndex) => {
                    const style = typeStyles[update.type];
                    const Icon = style.icon;
                    return (
                      <li key={`${month}-${update.type}-${updateIndex}`} className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/55 p-4 sm:flex-row sm:items-start">
                        <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold", style.className)}>
                          <Icon className="h-3.5 w-3.5" />
                          {update.type}
                        </span>
                        <p className="text-sm leading-6 text-[#3C3038] sm:pt-0.5">{update.text}</p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#8D294D]/10 text-[#8D294D]">
                {submitted ? <CheckCircle2 className="h-5 w-5" /> : <Lightbulb className="h-5 w-5" />}
              </div>
              <CardTitle className="font-serif text-2xl text-[#24171D]">User Suggestion</CardTitle>
              <CardDescription className="text-[#5F4A55]">
                Tell us what you want A.IDO to add, improve, or fix next.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                    Suggestions go straight to the A.IDO Team. We Appreciate your feedback!
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setSubmitted(false)}>
                    Send another suggestion
                  </Button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={submitSuggestion}>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-[#3C3038]" htmlFor="suggestion-name">Name</label>
                    <Input
                      id="suggestion-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your name"
                      autoComplete="name"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-[#3C3038]" htmlFor="suggestion-email">Email</label>
                    <Input
                      id="suggestion-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@email.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-[#3C3038]" htmlFor="suggestion-message">Suggestion</label>
                    <Textarea
                      id="suggestion-message"
                      value={suggestion}
                      onChange={(event) => setSuggestion(event.target.value)}
                      placeholder="What should we add or improve?"
                      rows={5}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                    <Send className="h-4 w-4" />
                    {isSubmitting ? "Sending..." : "Send Suggestion"}
                  </Button>
                  <p className="text-xs leading-5 text-[#6F5A65]">
                    Suggestions go straight to the A.IDO Team. We Appreciate your feedback!
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
