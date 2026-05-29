export const PLUS_ONE_STATUSES = ["none", "named", "name_tbd", "unsure"] as const;
export type PlusOneStatus = typeof PLUS_ONE_STATUSES[number];

export function normalizePlusOneStatus(raw: unknown, plusOne: unknown, plusOneName?: unknown): PlusOneStatus {
  if (typeof raw === "string" && (PLUS_ONE_STATUSES as readonly string[]).includes(raw)) {
    if (raw === "named" && !(typeof plusOneName === "string" && plusOneName.trim())) return "name_tbd";
    return raw as PlusOneStatus;
  }
  if (plusOne === true) {
    return typeof plusOneName === "string" && plusOneName.trim() ? "named" : "name_tbd";
  }
  return "none";
}

export function plusOneCountsAsGuest(status: PlusOneStatus): boolean {
  return status === "named" || status === "name_tbd";
}

export function plusOneNameForStatus(status: PlusOneStatus, name: unknown): string | null {
  if (status !== "named") return null;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}
