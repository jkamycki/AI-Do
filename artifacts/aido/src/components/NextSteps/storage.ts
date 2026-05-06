/**
 * Local storage layer for Next Steps user overrides (skip counts and manual
 * "mark as done" decisions). Auto-completion is derived from app data —
 * only user-driven overrides need to be persisted client-side.
 */

import type { StepId } from "./steps";

const storageKey = (userId: string) => `aido:next-steps:v1:${userId}`;
const SKIP_DEPRIORITIZE_THRESHOLD = 3;

export interface NextStepsOverrides {
  /** Number of times the user has skipped each step. */
  skipCounts: Partial<Record<StepId, number>>;
  /** Steps the user has manually marked as done (overrides auto-detection). */
  manuallyDone: Partial<Record<StepId, boolean>>;
}

const EMPTY: NextStepsOverrides = { skipCounts: {}, manuallyDone: {} };

export function loadOverrides(userId: string): NextStepsOverrides {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<NextStepsOverrides>;
    return {
      skipCounts: parsed.skipCounts ?? {},
      manuallyDone: parsed.manuallyDone ?? {},
    };
  } catch {
    return EMPTY;
  }
}

export function saveOverrides(overrides: NextStepsOverrides, userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(overrides));
  } catch {
    /* localStorage may be disabled — fail silently rather than crash the UI */
  }
}

export function incrementSkip(overrides: NextStepsOverrides, id: StepId): NextStepsOverrides {
  return {
    ...overrides,
    skipCounts: {
      ...overrides.skipCounts,
      [id]: (overrides.skipCounts[id] ?? 0) + 1,
    },
  };
}

export function clearSkip(overrides: NextStepsOverrides, id: StepId): NextStepsOverrides {
  const next = { ...overrides.skipCounts };
  delete next[id];
  return { ...overrides, skipCounts: next };
}

export function setManuallyDone(
  overrides: NextStepsOverrides,
  id: StepId,
  done: boolean,
): NextStepsOverrides {
  const next = { ...overrides.manuallyDone };
  if (done) next[id] = true;
  else delete next[id];
  return { ...overrides, manuallyDone: next };
}

export function isDeprioritized(skipCount: number): boolean {
  return skipCount >= SKIP_DEPRIORITIZE_THRESHOLD;
}

export { SKIP_DEPRIORITIZE_THRESHOLD };
