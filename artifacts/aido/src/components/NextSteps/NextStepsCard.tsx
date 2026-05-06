import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, SkipForward, Check, Lock, Heart } from "lucide-react";
import { useNextSteps, type ResolvedStep, type StepStatus } from "./useNextSteps";
import { AllStepsDialog } from "./AllStepsDialog";

const STATUS_BADGE: Record<StepStatus, { label: string; className: string }> = {
  not_started: {
    label: "Not Started",
    className: "bg-muted text-muted-foreground border-border",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800/40",
  },
  done: {
    label: "Done",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40",
  },
  skipped: {
    label: "Saved for Later",
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40",
  },
};

interface StepRowProps {
  resolved: ResolvedStep;
  onSkip: (id: ResolvedStep["step"]["id"]) => void;
  onMarkDone: (id: ResolvedStep["step"]["id"]) => void;
  variant?: "active" | "compact";
}

export function StepRow({ resolved, onSkip, onMarkDone, variant = "active" }: StepRowProps) {
  const { step, status, isLocked, isDeprioritized } = resolved;
  const Icon = step.icon;
  const badge = STATUS_BADGE[status];

  return (
    <div
      className={`group rounded-lg border border-border/60 bg-card p-4 transition-colors hover:border-border ${
        isDeprioritized ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{step.title}</h3>
            {step.optional && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                Optional
              </Badge>
            )}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{step.description}</p>

          {variant === "active" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isLocked ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Unlocks once earlier steps are done
                </span>
              ) : (
                <>
                  <Link href={step.route}>
                    <Button size="sm" className="gap-1.5">
                      Start
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground gap-1.5"
                    onClick={() => onMarkDone(step.id)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Mark Done
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground gap-1.5"
                    onClick={() => onSkip(step.id)}
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    Skip for Now
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NextStepsCard() {
  const [allOpen, setAllOpen] = useState(false);
  const { activeSteps, skippedSteps, allSteps, completedCount, totalCount, skip, markDone, reactivate } =
    useNextSteps();

  // If everything is done, show a celebratory state instead of an empty list.
  const allDone = activeSteps.length === 0 && skippedSteps.length === 0;

  return (
    <>
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Your Next Steps
              <Badge variant="outline" className="font-normal">
                {completedCount} of {totalCount} done
              </Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setAllOpen(true)}>
              View All Steps
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            A calm, paced plan — take what feels right today and come back tomorrow for the rest.
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          {allDone ? (
            <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-900/15 dark:border-emerald-800/40 p-6 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-3">
                <Heart className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                You're all caught up!
              </p>
              <p className="text-sm text-emerald-800/80 dark:text-emerald-300/70 mt-1">
                Every key step is taken care of. Take a breath — you've earned it.
              </p>
            </div>
          ) : (
            activeSteps.map((r) => (
              <StepRow key={r.step.id} resolved={r} onSkip={skip} onMarkDone={markDone} />
            ))
          )}

          {skippedSteps.length > 0 && (
            <div className="pt-2 mt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setAllOpen(true)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
              >
                <SkipForward className="h-3 w-3" />
                {skippedSteps.length} {skippedSteps.length === 1 ? "step" : "steps"} saved for later — revisit anytime
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <AllStepsDialog
        open={allOpen}
        onOpenChange={setAllOpen}
        allSteps={allSteps}
        skippedSteps={skippedSteps}
        onSkip={skip}
        onMarkDone={markDone}
        onReactivate={reactivate}
      />
    </>
  );
}
