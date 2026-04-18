import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Calendar, CheckCircle2, DollarSign, Clock, AlertCircle, Mail, ListChecks, Wallet, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: summary, isLoading, isError } = useGetDashboardSummary();

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-5 w-1/4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-serif">Something went wrong</h2>
        <p className="text-muted-foreground">We couldn't load your dashboard summary.</p>
        <Button onClick={() => window.location.reload()} data-testid="btn-retry">Retry</Button>
      </div>
    );
  }

  const isProfileComplete = summary.hasProfile;
  
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-serif text-primary">Overview</h1>
        <p className="text-lg text-muted-foreground mt-2">Welcome back. Here is where everything stands.</p>
      </div>

      {!isProfileComplete && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center md:text-left">
              <h3 className="font-serif text-xl text-primary">Let's set the stage</h3>
              <p className="text-muted-foreground">Complete your wedding profile to unlock AI recommendations tailored to your vibe.</p>
            </div>
            <Link href="/profile" className="shrink-0">
              <Button size="lg" data-testid="btn-complete-profile">Complete Profile</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover-elevate transition-all border-none shadow-md overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Countdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-serif font-bold text-foreground">
              {summary.daysUntilWedding > 0 ? summary.daysUntilWedding : 0}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Days remaining</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-none shadow-md overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">
              ${summary.budgetSpent.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              of ${summary.budgetTotal.toLocaleString()} spent
            </p>
            <Progress value={summary.budgetTotal > 0 ? (summary.budgetSpent / summary.budgetTotal) * 100 : 0} className="h-2 mt-3" />
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-none shadow-md overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">
              {summary.checklistCompleted} <span className="text-xl text-muted-foreground font-sans font-normal">/ {summary.checklistTotal}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Tasks completed</p>
            <Progress value={summary.checklistProgress} className="h-2 mt-3" />
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-none shadow-md overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif font-bold text-foreground">
              {summary.timelineEventCount}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Events scheduled</p>
            {!summary.hasTimeline && (
              <Link href="/timeline" className="text-xs text-primary font-medium hover:underline mt-2 inline-block">
                Generate Timeline &rarr;
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Quick Actions</CardTitle>
            <CardDescription>Tools to help you stay on track</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Link href="/vendor-email" className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all group">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <Mail className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground">Draft Vendor Email</h4>
                <p className="text-sm text-muted-foreground">Use AI to write professional emails to your vendors</p>
              </div>
            </Link>
            <Link href="/budget" className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all group">
              <div className="h-10 w-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                <DollarSign className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground">Log an Expense</h4>
                <p className="text-sm text-muted-foreground">Update your budget and see AI cost predictions</p>
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <CardHeader>
            <CardTitle className="font-serif text-2xl text-primary-foreground">Day-Of Coordinator</CardTitle>
            <CardDescription className="text-primary-foreground/80">For the big day</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 relative z-10">
            <p className="text-primary-foreground/90">
              When the day arrives, switch to Day-Of mode. Get a clean view of your timeline and instant AI advice for any unexpected emergencies.
            </p>
            <Link href="/day-of" className="inline-block">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto font-medium" data-testid="btn-day-of-mode">
                Open Day-Of Mode
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
