import { useState } from "react";
import { Link } from "wouter";
import { Sparkles, ArrowRight, X, SkipForward } from "lucide-react";
import { useNextSteps } from "./useNextSteps";

export function NextStepNudge() {
  const { activeSteps, completedCount, totalCount, skip, markDone } = useNextSteps();
  const [dismissed, setDismissed] = useState(false);

  // Pick the single top step (first non-deprioritized, or first available)
  const next = activeSteps[0];

  if (!next || dismissed || completedCount === totalCount) return null;

  const Icon = next.step.icon;

  return (
    <div className="fixed top-20 right-4 z-50 md:top-6 md:right-6 w-72 shadow-lg rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm animate-in slide-in-from-right-4 fade-in duration-300">
      <div className="p-3.5">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground tracking-wide uppercase">
              Next Step
            </span>
            <span className="text-xs text-muted-foreground">
              {completedCount}/{totalCount}
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Step */}
        <div className="flex items-start gap-2.5">
          <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">
              {next.step.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {next.step.description}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <Link href={next.step.route} className="flex-1">
            <button className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
              Start
              <ArrowRight className="h-3 w-3" />
            </button>
          </Link>
          <button
            onClick={() => skip(next.step.id)}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <SkipForward className="h-3 w-3" />
            Skip
          </button>
          <button
            onClick={() => markDone(next.step.id)}
            className="h-8 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-b-xl overflow-hidden">
        <div
          className="h-full bg-primary/60 transition-all duration-500"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>
    </div>
  );
}
