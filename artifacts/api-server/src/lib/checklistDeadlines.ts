export type ChecklistDeadlineTask = {
  month: string;
  task: string;
  description: string;
  dueDate?: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeChecklistDueDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === trimmed ? trimmed : null;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(value: unknown): string | null {
  const normalized = normalizeChecklistDueDate(value);
  if (normalized) return normalized;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? toDateKey(parsed) : null;
}

function dateFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function offsetDaysForPeriod(month: string): number {
  const label = month.toLowerCase();
  if (label.includes("12+") || label.includes("12 months")) return 365;
  if (label.includes("9-12") || label.includes("9 to 12")) return 300;
  if (label.includes("6-9") || label.includes("6 to 9")) return 210;
  if (label.includes("3-6") || label.includes("3 to 6")) return 120;
  if (label.includes("1-3") || label.includes("1 to 3")) return 45;
  if (label.includes("1 month") || label.includes("month before")) return 21;
  if (label.includes("1 week") || label.includes("week before")) return 5;
  if (label.includes("day before") || label.includes("wedding day")) return 1;
  if (label.includes("planning focus")) return 30;
  return 30;
}

function clampBeforeWedding(candidate: Date, wedding: Date): string {
  const today = dateFromKey(toDateKey(new Date()));
  const latestAllowed = addDays(wedding, -1);
  let due = candidate;

  if (due.getTime() >= wedding.getTime()) {
    due = latestAllowed;
  }
  if (due.getTime() > latestAllowed.getTime()) {
    due = latestAllowed;
  }
  if (due.getTime() < today.getTime() && today.getTime() <= latestAllowed.getTime()) {
    due = today;
  }

  return toDateKey(due);
}

export function applyChecklistDeadlines<T extends ChecklistDeadlineTask>(
  tasks: T[],
  weddingDate: unknown,
): T[] {
  const weddingKey = parseDateKey(weddingDate);
  if (!weddingKey) {
    return tasks.map((task) => ({ ...task, dueDate: normalizeChecklistDueDate(task.dueDate) }));
  }

  const wedding = dateFromKey(weddingKey);
  return tasks.map((task) => {
    const existingKey = normalizeChecklistDueDate(task.dueDate);
    const candidate = existingKey
      ? dateFromKey(existingKey)
      : addDays(wedding, -offsetDaysForPeriod(task.month));

    return {
      ...task,
      dueDate: clampBeforeWedding(candidate, wedding),
    };
  });
}
