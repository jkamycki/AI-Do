import { useGetDashboardSummary } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  CalendarDays,
  DollarSign,
  CheckSquare,
  Clock,
  Mail,
  Smartphone,
  ArrowRight,
  Sparkles,
  Heart,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function CountdownRing({ days }: { days: number }) {
  const cap = 365;
  const pct = Math.max(0, Math.min(1, days / cap));
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct);

  return (
    <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-primary/10" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke="currentColor" strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
          className="text-primary transition-all duration-700"
        />
      </svg>
      <div className="text-center z-10">
        <div className="text-4xl font-serif font-bold text-primary leading-none">{days}</div>
        <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">days</div>
      </div>
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  sub,
  progress,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  progress?: number;
  href: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-card border border-border/60 rounded-2xl p-4 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
        <div className="flex items-center gap-2 text-muted-foreground mb-3">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        </div>
        <div className="text-2xl font-serif font-semibold text-foreground">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        {progress !== undefined && (
          <Progress value={progress} className="h-1.5 mt-2.5" />
        )}
      </div>
    </Link>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  cta,
  ctaLabel,
  stat,
  accent = false,
  testId,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  cta: string;
  ctaLabel: string;
  stat?: React.ReactNode;
  accent?: boolean;
  testId?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl p-6 flex flex-col gap-4 overflow-hidden border transition-all duration-300 group
        ${accent
          ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20"
          : "bg-card border-border/60 hover:border-primary/30 hover:shadow-md"
        }`}
    >
      {accent && (
        <>
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-4 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
        </>
      )}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10
        ${accent ? "bg-white/20" : "bg-primary/10 group-hover:bg-primary/15 transition-colors"}`}>
        <Icon className={`h-5 w-5 ${accent ? "text-white" : "text-primary"}`} />
      </div>
      <div className="relative z-10 flex-1">
        <h3 className={`font-serif text-lg font-semibold mb-1 ${accent ? "text-white" : "text-foreground"}`}>{title}</h3>
        <p className={`text-sm leading-relaxed ${accent ? "text-white/75" : "text-muted-foreground"}`}>{description}</p>
        {stat && <div className="mt-3">{stat}</div>}
      </div>
      <Link href={cta} className="relative z-10">
        <Button
          size="sm"
          variant={accent ? "secondary" : "outline"}
          className={`w-full group-hover:gap-3 transition-all ${
            accent
              ? "bg-white/20 hover:bg-white/30 text-white border-white/20"
              : "border-primary/20 text-primary hover:bg-primary/5"
          }`}
          data-testid={testId}
        >
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </Link>
    </div>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading, isError } = useGetDashboardSummary();
  const { user } = useUser();

  const firstName = user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ?? "there";

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-serif">Something went wrong</h2>
        <p className="text-muted-foreground">We couldn't load your dashboard.</p>
        <Button onClick={() => window.location.reload()} data-testid="btn-retry">Retry</Button>
      </div>
    );
  }

  const budgetPct = summary.budgetTotal > 0
    ? Math.round((summary.budgetSpent / summary.budgetTotal) * 100)
    : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Greeting */}
      <div>
        <p className="text-sm text-muted-foreground font-medium">{getGreeting()},</p>
        <h1 className="text-3xl md:text-4xl font-serif text-foreground mt-0.5 capitalize">{firstName} 🤍</h1>
      </div>

      {/* Profile setup prompt */}
      {!summary.hasProfile && (
        <div className="rounded-2xl bg-primary/8 border border-primary/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Set up your wedding profile</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Add your date, venue, and details to unlock all AI features.</p>
            </div>
          </div>
          <Link href="/profile" className="shrink-0">
            <Button size="sm" className="whitespace-nowrap" data-testid="btn-complete-profile">
              Complete Profile <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Countdown Hero */}
      <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row items-center gap-6">
          <CountdownRing days={summary.daysUntilWedding} />
          <div className="text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-primary mb-1">
              <Heart className="h-4 w-4 fill-primary" />
              <span className="text-sm font-medium uppercase tracking-wider">Until your wedding</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif text-foreground">
              {!summary.hasProfile
                ? "Your journey begins here"
                : summary.daysUntilWedding === 0
                ? "Today is the day! 🎉"
                : summary.daysUntilWedding === 1
                ? "Tomorrow is the big day!"
                : `${summary.daysUntilWedding} days to go`}
            </h2>
            {summary.hasProfile && summary.daysUntilWedding > 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground justify-center sm:justify-start">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Countdown is live</span>
              </div>
            )}
            {!summary.hasProfile && (
              <p className="text-sm text-muted-foreground mt-1">Complete your profile to start the countdown</p>
            )}
          </div>
        </div>
        {/* Decorative gradient bar */}
        <div className="h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatChip
          icon={DollarSign}
          label="Budget"
          value={`$${summary.budgetSpent.toLocaleString()}`}
          sub={`of $${summary.budgetTotal.toLocaleString()} spent`}
          progress={budgetPct}
          href="/budget"
        />
        <StatChip
          icon={CheckSquare}
          label="Checklist"
          value={`${summary.checklistCompleted}/${summary.checklistTotal}`}
          sub={`${Math.round(summary.checklistProgress)}% done`}
          progress={summary.checklistProgress}
          href="/checklist"
        />
        <StatChip
          icon={Clock}
          label="Timeline"
          value={`${summary.timelineEventCount}`}
          sub="events scheduled"
          href="/timeline"
        />
        <StatChip
          icon={MapPin}
          label="Profile"
          value={summary.hasProfile ? "Complete" : "Pending"}
          sub={summary.hasProfile ? "All set" : "Tap to fill in"}
          href="/profile"
        />
      </div>

      {/* Feature Cards */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Planning Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          <FeatureCard
            icon={Clock}
            title="Timeline"
            description="A minute-by-minute schedule for your entire wedding day, built by AI from your profile."
            cta="/timeline"
            ctaLabel={summary.hasTimeline ? "View Timeline" : "Generate Timeline"}
            stat={summary.hasTimeline
              ? <div className="text-sm font-medium text-primary">{summary.timelineEventCount} events planned</div>
              : <div className="text-xs text-muted-foreground">No timeline yet — let AI build one</div>
            }
            testId="btn-goto-timeline"
          />

          <FeatureCard
            icon={DollarSign}
            title="Budget Manager"
            description="Track every expense and get AI-powered cost predictions based on your location and guest count."
            cta="/budget"
            ctaLabel="Manage Budget"
            stat={
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>${summary.budgetSpent.toLocaleString()} spent</span>
                  <span>{budgetPct}%</span>
                </div>
                <Progress value={budgetPct} className="h-1.5" />
              </div>
            }
            testId="btn-goto-budget"
          />

          <FeatureCard
            icon={CheckSquare}
            title="Checklist"
            description="Month-by-month planning tasks tailored to your wedding date, guest count, and vibe."
            cta="/checklist"
            ctaLabel={summary.hasChecklist ? "Continue Checklist" : "Create Checklist"}
            stat={
              summary.hasChecklist ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{summary.checklistCompleted} of {summary.checklistTotal} done</span>
                    <span>{Math.round(summary.checklistProgress)}%</span>
                  </div>
                  <Progress value={summary.checklistProgress} className="h-1.5" />
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Generate your personalized task list</div>
              )
            }
            testId="btn-goto-checklist"
          />

          <FeatureCard
            icon={Mail}
            title="Vendor Emails"
            description="Write professional inquiry, quote, and follow-up emails to any vendor in seconds with AI."
            cta="/vendor-email"
            ctaLabel="Draft an Email"
            testId="btn-goto-vendor-email"
          />

          <FeatureCard
            icon={Smartphone}
            title="Day-Of Mode"
            description="On your wedding day, get a clean mobile view of your timeline and instant AI help for any emergency."
            cta="/day-of"
            ctaLabel="Open Day-Of Mode"
            accent
            testId="btn-day-of-mode"
          />

        </div>
      </div>
    </div>
  );
}
