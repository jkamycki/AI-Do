import { useCallback, useEffect, useMemo, useState } from "react";
import { useGetDashboardSummary, useListVendors } from "@workspace/api-client-react";
import { authFetch } from "@/lib/authFetch";
import { useQuery } from "@tanstack/react-query";
import { STEPS, STEP_BY_ID, type NextStepsData, type StepId, type StepDefinition } from "./steps";
import {
  loadOverrides,
  saveOverrides,
  incrementSkip,
  clearSkip,
  setManuallyDone,
  isDeprioritized,
  type NextStepsOverrides,
} from "./storage";

export type StepStatus = "not_started" | "in_progress" | "done" | "skipped";

export interface ResolvedStep {
  step: StepDefinition;
  status: StepStatus;
  skipCount: number;
  isLocked: boolean;
  isDeprioritized: boolean;
}

const ACTIVE_STEPS_LIMIT = 5;
const ACTIVE_STEPS_MIN = 3;

/**
 * Resolves each step's status by combining auto-detection from app data with
 * user overrides (manual "done" toggles and skip counts). Returns the steps
 * filtered/sorted for both the active list and the "view all" / "skipped"
 * sections.
 */
export function useNextSteps() {
  const [overrides, setOverrides] = useState<NextStepsOverrides>(() => loadOverrides());

  useEffect(() => {
    saveOverrides(overrides);
  }, [overrides]);

  const { data: summary } = useGetDashboardSummary();
  const { data: vendorsData } = useListVendors();

  // These four endpoints aren't in the generated client; query them directly so
  // the dashboard summary stays small and unchanged.
  const { data: contracts } = useQuery<{ id: number }[]>({
    queryKey: ["next-steps", "contracts"],
    queryFn: async () => {
      const r = await authFetch("/api/contracts");
      if (!r.ok) return [];
      const json = await r.json();
      return Array.isArray(json) ? json : (json.contracts ?? []);
    },
    staleTime: 60_000,
  });
  const { data: hotels } = useQuery<{ id: number }[]>({
    queryKey: ["next-steps", "hotels"],
    queryFn: async () => {
      const r = await authFetch("/api/hotels");
      if (!r.ok) return [];
      const json = await r.json();
      return Array.isArray(json) ? json : (json.hotels ?? []);
    },
    staleTime: 60_000,
  });
  const { data: seating } = useQuery<{ tables?: unknown[] }>({
    queryKey: ["next-steps", "seating-charts"],
    queryFn: async () => {
      const r = await authFetch("/api/seating/charts");
      if (!r.ok) return { tables: [] };
      const json = await r.json();
      // Endpoint returns either { charts: [...] } or an array of charts; treat
      // any non-empty list as evidence the user has started seating.
      const charts = Array.isArray(json) ? json : (json.charts ?? []);
      return { tables: charts };
    },
    staleTime: 60_000,
  });

  const data: NextStepsData = useMemo(
    () => ({
      hasProfile: Boolean(summary?.hasProfile),
      guestCount: summary?.guestCount ?? 0,
      budgetTotal: summary?.budgetTotal ?? 0,
      vendorCount: vendorsData?.vendors?.length ?? 0,
      contractCount: contracts?.length ?? 0,
      hasChecklist: Boolean(summary?.hasChecklist),
      checklistTotal: summary?.checklistTotal ?? 0,
      hasTimeline: Boolean(summary?.hasTimeline),
      timelineEventCount: summary?.timelineEventCount ?? 0,
      hotelCount: hotels?.length ?? 0,
      seatingTableCount: seating?.tables?.length ?? 0,
      // Day-of has no single completable signal; rely on manual "Mark Done".
      hasDayOfPlan: false,
    }),
    [summary, vendorsData, contracts, hotels, seating],
  );

  const resolveStatus = useCallback(
    (step: StepDefinition): StepStatus => {
      const auto = step.isAutoComplete?.(data) ?? false;
      const manual = overrides.manuallyDone[step.id] ?? false;
      if (auto || manual) return "done";
      const skipCount = overrides.skipCounts[step.id] ?? 0;
      if (skipCount > 0) return "skipped";
      return "not_started";
    },
    [data, overrides],
  );

  const resolved: ResolvedStep[] = useMemo(
    () =>
      STEPS.map((step) => {
        const status = resolveStatus(step);
        const skipCount = overrides.skipCounts[step.id] ?? 0;
        const isLocked = step.dependsOn?.some(
          (depId) => resolveStatus(STEP_BY_ID[depId]) !== "done",
        ) ?? false;
        return {
          step,
          status,
          skipCount,
          isLocked,
          isDeprioritized: isDeprioritized(skipCount) && status !== "done",
        };
      }),
    [resolveStatus, overrides],
  );

  /**
   * Active steps shown in the dashboard card:
   *  - Hide done steps and steps blocked by prerequisites
   *  - Send deprioritized (skipped 3+ times) steps to the bottom but keep them visible
   *  - Cap at 5 entries; aim for at least 3 when possible
   */
  const activeSteps: ResolvedStep[] = useMemo(() => {
    const candidates = resolved.filter((r) => !r.isLocked && r.status !== "done");
    const sorted = [...candidates].sort((a, b) => {
      if (a.isDeprioritized !== b.isDeprioritized) return a.isDeprioritized ? 1 : -1;
      // Otherwise preserve definition order via the underlying array index
      return STEPS.indexOf(a.step) - STEPS.indexOf(b.step);
    });
    return sorted.slice(0, Math.max(ACTIVE_STEPS_MIN, Math.min(ACTIVE_STEPS_LIMIT, sorted.length)));
  }, [resolved]);

  const skippedSteps: ResolvedStep[] = useMemo(
    () => resolved.filter((r) => r.skipCount > 0 && r.status !== "done"),
    [resolved],
  );

  const completedCount = resolved.filter((r) => r.status === "done").length;
  const totalCount = resolved.length;

  const skip = useCallback((id: StepId) => {
    setOverrides((prev) => incrementSkip(prev, id));
  }, []);

  const markDone = useCallback((id: StepId) => {
    setOverrides((prev) => setManuallyDone(prev, id, true));
  }, []);

  const reactivate = useCallback((id: StepId) => {
    setOverrides((prev) => {
      const cleared = clearSkip(prev, id);
      return setManuallyDone(cleared, id, false);
    });
  }, []);

  return {
    activeSteps,
    skippedSteps,
    allSteps: resolved,
    completedCount,
    totalCount,
    skip,
    markDone,
    reactivate,
  };
}
