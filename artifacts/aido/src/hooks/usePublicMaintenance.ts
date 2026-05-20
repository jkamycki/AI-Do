import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/authFetch";
import { DEFAULT_MAINTENANCE_MESSAGE } from "@/components/MaintenanceNotice";

export type MaintenanceSection =
  | "guest-collector"
  | "rsvp"
  | "save-the-date"
  | "wedding-website"
  | "public-guest-experience"
  | "portal-dashboard"
  | "portal-profile"
  | "portal-mood-board"
  | "portal-timeline"
  | "portal-checklist"
  | "portal-vendors"
  | "portal-budget"
  | "portal-documents"
  | "portal-guests"
  | "portal-wedding-party"
  | "portal-seating-chart"
  | "portal-hotels"
  | "portal-aria"
  | "portal-day-of"
  | "portal-website-editor"
  | "portal-experience";

export type PublicMaintenanceState = {
  active: boolean;
  section: MaintenanceSection;
  message: string;
  activeSection: MaintenanceSection | null;
  expiresAt: string | null;
};

export function usePublicMaintenance(section: MaintenanceSection) {
  return useQuery({
    queryKey: ["public-maintenance", section],
    queryFn: async () => {
      const res = await apiFetch(`/api/maintenance/public?section=${encodeURIComponent(section)}`);
      if (!res.ok) {
        return {
          active: false,
          section,
          message: DEFAULT_MAINTENANCE_MESSAGE,
          activeSection: null,
          expiresAt: null,
        } satisfies PublicMaintenanceState;
      }
      const data = await res.json() as Partial<PublicMaintenanceState>;
      return {
        active: !!data.active,
        section,
        message: data.message || DEFAULT_MAINTENANCE_MESSAGE,
        activeSection: data.activeSection ?? null,
        expiresAt: data.expiresAt ?? null,
      } satisfies PublicMaintenanceState;
    },
    staleTime: 15_000,
    retry: false,
  });
}
