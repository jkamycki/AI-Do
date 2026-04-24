import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import {
  HelpCircle, MessageSquare, Star, Send, CheckCircle2,
  ChevronDown, ChevronUp, Mail, Lightbulb, Bug, Heart,
  ThumbsUp, BookOpen,
} from "lucide-react";

const FEEDBACK_CATEGORIES = [
  { value: "bug", label: "Bug Report", icon: Bug, color: "text-red-600 bg-red-50 border-red-200" },
  { value: "feature", label: "Feature Request", icon: Lightbulb, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "general", label: "General Feedback", icon: ThumbsUp, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "praise", label: "Something I Love", icon: Heart, color: "text-rose-600 bg-rose-50 border-rose-200" },
];

const FAQ_ITEMS = [
  {
    q: "How do I generate my wedding timeline?",
    a: "Go to the Timeline page and click 'Generate with AI'. Make sure you've filled in your Wedding Profile first — Aria uses your ceremony time, venue, and vibe to create a personalized minute-by-minute schedule.",
  },
  {
    q: "Can I invite my wedding planner to A.IDO?",
    a: "Yes! Head to Settings → Collaborators and click 'Create Invite Link'. Share the link with your planner — they'll get Planner access to edit your timeline, checklist, budget, and vendor emails.",
  },
  {
    q: "How do I export my timeline as a PDF?",
    a: "After generating your timeline, click the 'Download PDF' button on the Timeline page. You'll get a beautifully branded A.IDO PDF ready to share with vendors.",
  },
  {
    q: "How does the Budget Manager work?",
    a: "Visit the Budget Manager page to add budget items by category (catering, flowers, photography, etc.). Track estimated vs. actual costs, mark items as paid, and use the AI prediction tool to estimate costs for your location.",
  },
  {
    q: "What is the Day-Of Coordinator?",
    a: "It's your emergency AI assistant for the wedding day itself! Activate it on the Day-Of page to get real-time help with any issues — vendor delays, weather problems, schedule changes — anything that comes up.",
  },
  {
    q: "How do I manage my vendors?",
    a: "Go to the Vendors page to add all your vendors with contact info, contract status, payment milestones, and file uploads. The Vendor Emails page lets you draft professional emails to them with AI.",
  },
];

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          className="p-0.5 transition-transform hover:scale-110 active:scale-95"
        >
          <Star
            className={`h-7 w-7 transition-colors ${
              n <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="font-medium text-sm text-foreground pr-4">{q}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 text-sm text-muted-foreground leading-relaxed border-t border-border/30 bg-muted/10">
          <p className="pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"contact" | "feedback" | "faq">("contact");
  const [contactSuccess, setContactSuccess] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const [contactForm, setContactForm] = useState({
    name: user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "",
    email: user?.emailAddresses[0]?.emailAddress ?? "",
    subject: "",
    message: "",
  });

  const [feedbackForm, setFeedbackForm] = useState({
    rating: 0,
    category: "",
    message: "",
  });

  const authedFetch = async (url: string, init: RequestInit = {}) => {
    const token = await getToken();
    return fetch(url, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  const contactMutation = useMutation({
    mutationFn: async () => {
      const r = await authedFetch("/api/help/contact", {
        method: "POST",
        body: JSON.stringify(contactForm),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Failed to send");
      }
      return r.json();
    },
    onSuccess: () => {
      setContactSuccess(true);
      setContactForm(prev => ({ ...prev, subject: "", message: "" }));
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const r = await authedFetch("/api/help/feedback", {
        method: "POST",
        body: JSON.stringify(feedbackForm),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Failed to send");
      }
      return r.json();
    },
    onSuccess: () => {
      setFeedbackSuccess(true);
      setFeedbackForm({ rating: 0, category: "", message: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-serif text-primary flex items-center gap-3">
          <HelpCircle className="h-8 w-8" />
          {t("help.title")}
        </h1>
        <p className="text-lg text-muted-foreground mt-1">
          {t("help.subtitle")}
        </p>
      </div>

      <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit">
        {([
          ["contact", t("help.contact_us"), Mail],
          ["feedback", t("help.feedback"), Star],
          ["faq", t("help.faq"), BookOpen],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === key ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "contact" && (
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-xl flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Contact Support
            </CardTitle>
            <CardDescription>
              Send us a message and our team will review it and get back to you as soon as possible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contactSuccess ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="font-serif text-xl text-foreground">Message Received!</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Thank you for reaching out. The A.IDO team will review your message and get back to you shortly.
                </p>
                <Button variant="outline" onClick={() => setContactSuccess(false)}>
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form
                onSubmit={e => { e.preventDefault(); contactMutation.mutate(); }}
                className="space-y-4"
              >
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Your Name</label>
                    <Input
                      placeholder="Jane Smith"
                      value={contactForm.name}
                      onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                      required
                      className="border-primary/20 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Your Email</label>
                    <Input
                      type="email"
                      placeholder="you@email.com"
                      value={contactForm.email}
                      onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                      required
                      className="border-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Subject</label>
                  <Input
                    placeholder="What do you need help with?"
                    value={contactForm.subject}
                    onChange={e => setContactForm(p => ({ ...p, subject: e.target.value }))}
                    required
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    placeholder="Describe your question or issue in detail…"
                    value={contactForm.message}
                    onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))}
                    required
                    rows={5}
                    className="border-primary/20 focus:border-primary resize-none"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={contactMutation.isPending}
                  className="gap-2 w-full sm:w-auto"
                >
                  <Send className="h-4 w-4" />
                  {contactMutation.isPending ? "Sending…" : "Send Message"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "feedback" && (
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-xl flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Leave Feedback
            </CardTitle>
            <CardDescription>
              Help us make A.IDO better. Share your ideas, report bugs, or just tell us what you love!
            </CardDescription>
          </CardHeader>
          <CardContent>
            {feedbackSuccess ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Heart className="h-8 w-8 text-primary fill-primary" />
                </div>
                <h3 className="font-serif text-xl text-foreground">Thank You!</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Your feedback means the world to us. We read every submission and use it to make A.IDO better for couples everywhere.
                </p>
                <Button variant="outline" onClick={() => setFeedbackSuccess(false)}>
                  Leave More Feedback
                </Button>
              </div>
            ) : (
              <form
                onSubmit={e => { e.preventDefault(); feedbackMutation.mutate(); }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium">Overall Rating</label>
                  <StarRating
                    value={feedbackForm.rating}
                    onChange={n => setFeedbackForm(p => ({ ...p, rating: n }))}
                  />
                  {feedbackForm.rating > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {["", "Needs a lot of work", "Could be better", "Pretty good", "Really enjoying it", "Absolutely love it!"][feedbackForm.rating]}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {FEEDBACK_CATEGORIES.map(cat => {
                      const Icon = cat.icon;
                      const selected = feedbackForm.category === cat.value;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setFeedbackForm(p => ({ ...p, category: cat.value }))}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm text-left transition-all
                            ${selected
                              ? `${cat.color} border-current font-medium`
                              : "border-border hover:border-primary/30 text-foreground"
                            }`}
                        >
                          <Icon className={`h-4 w-4 ${selected ? "" : "text-muted-foreground"}`} />
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Your Feedback</label>
                  <Textarea
                    placeholder="Tell us what's on your mind — feature ideas, bug reports, what you love or wish worked differently…"
                    value={feedbackForm.message}
                    onChange={e => setFeedbackForm(p => ({ ...p, message: e.target.value }))}
                    required
                    rows={5}
                    className="border-primary/20 focus:border-primary resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={feedbackMutation.isPending}
                  className="gap-2 w-full sm:w-auto"
                >
                  <Send className="h-4 w-4" />
                  {feedbackMutation.isPending ? "Sending…" : "Submit Feedback"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "faq" && (
        <div className="space-y-4">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Frequently Asked Questions
              </CardTitle>
              <CardDescription>
                Quick answers to common questions about A.IDO.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {FAQ_ITEMS.map(item => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-primary/5 border-primary/10">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Still have questions?</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Can't find what you're looking for? Contact our support team or ask Aria — our AI assistant (sparkle button, bottom right).
                </p>
              </div>
              <Button variant="outline" onClick={() => setActiveTab("contact")} className="shrink-0">
                Contact Us
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
