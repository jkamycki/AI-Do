import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, RotateCcw, Lock, SkipForward } from "lucide-react";
import type { ResolvedStep, StepStatus } from "./useNextSteps";
import type { StepId } from "./steps";

const STATUS_LABEL: Record<StepStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  done: "Done",
  skipped: "Saved for Later",
};

const STATUS_CLASS: Record<StepStatus, string> = {
  not_started: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800/40",
  done: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40",
  skipped: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40",
};

interface AllStepsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allSteps: ResolvedStep[];
  skippedSteps: ResolvedStep[];
  onSkip: (id: StepId) => void;
  onMarkDone: (id: StepId) => void;
  onReactivate: (id: StepId) => void;
}

export function AllStepsDialog({
  open,
  onOpenChange,
  allSteps,
  skippedSteps,
  onSkip,
  onMarkDone,
  onReactivate,
}: AllStepsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif">All Wedding Planning Steps</DialogTitle>
          <DialogDescription>
            Here's the full picture. Take steps in the order that feels right — there's no wrong way to plan your wedding.
          </DialogDescription>
        </DialogHeader>

        {skippedSteps.length > 0 && (
          <section className="space-y-2 rounded-lg border border-amber-200/60 bg-amber-50/40 dark:bg-amber-900/10 dark:border-amber-800/30 p-4">
            <h3 className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
              <SkipForward className="h-4 w-4" />
              Saved for Later ({skippedSteps.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              No pressure — revisit any of these whenever you're ready.
            </p>
            <ul className="space-y-2 mt-2">
              {skippedSteps.map((r) => (
                <li
                  key={r.step.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-card p-3 border border-border/60"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.step.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Skipped {r.skipCount} {r.skipCount === 1 ? "time" : "times"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 shrink-0"
                    onClick={() => onReactivate(r.step.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Bring Back
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3 mt-2">
          <h3 className="text-sm font-semibold text-foreground">All Steps in Order</h3>
          <ol className="space-y-2">
            {allSteps.map((r, idx) => {
              const Icon = r.step.icon;
              return (
                <li
                  key={r.step.id}
                  className={`rounded-lg border border-border/60 p-3 ${
                    r.status === "done" ? "bg-emerald-50/30 dark:bg-emerald-900/5" : "bg-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium text-foreground">{r.step.title}</p>
                        {r.step.optional && (
                          <Badge variant="outline" className="text-[10px] uppercase">
                            Optional
                          </Badge>
                        )}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_CLASS[r.status]}`}
                        >
                          {STATUS_LABEL[r.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{r.step.description}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {r.isLocked ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock className="h-3 w-3" />
                            Unlocks after earlier steps
                          </span>
                        ) : r.status === "done" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                            <Check className="h-3 w-3" />
                            Complete
                          </span>
                        ) : (
                          <>
                            <Link href={r.step.route} onClick={() => onOpenChange(false)}>
                              <Button size="sm" variant="outline" className="h-7 gap-1">
                                Start
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-muted-foreground gap-1"
                              onClick={() => onMarkDone(r.step.id)}
                            >
                              <Check className="h-3 w-3" />
                              Mark Done
                            </Button>
                            {r.status !== "skipped" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-muted-foreground gap-1"
                                onClick={() => onSkip(r.step.id)}
                              >
                                <SkipForward className="h-3 w-3" />
                                Skip
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </DialogContent>
    </Dialog>
  );
}
