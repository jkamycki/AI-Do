import { useState, useEffect, useRef, useCallback } from "react";
import { authFetch } from "@/lib/authFetch";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetProfile, useSaveProfile, getGetProfileQueryKey, getGetBudgetQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, RotateCcw, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { COUNTRIES } from "@/lib/countries";
import { getAddressFormat } from "@/lib/addressFormat";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { VenueQuestion, type VenueStatus } from "@/components/Profile/VenueQuestion";
import { VenueWizard, emptyVenueDiscoveryData, type VenueDiscoveryData } from "@/components/Profile/VenueWizard";
import { normalizeRequirementsSelectorValue } from "@/components/Profile/RequirementsSelector";
import { cn } from "@/lib/utils";

const NO_COUNTRY = "__none__";

type PlanningPriorityKey = "mustHaves" | "niceToHaves" | "mustAvoids";
type PlanningPriorities = Record<PlanningPriorityKey, string[]>;

const emptyPlanningPriorities: PlanningPriorities = {
  mustHaves: [],
  niceToHaves: [],
  mustAvoids: [],
};

const planningPrioritiesSchema = z.object({
  mustHaves: z.array(z.string()).default([]),
  niceToHaves: z.array(z.string()).default([]),
  mustAvoids: z.array(z.string()).default([]),
}).default(emptyPlanningPriorities);

const WEDDING_PRIORITY_OPTIONS = [
  "Photography",
  "Videography",
  "Venue",
  "Florals",
  "Catering",
  "Cake and desserts",
  "Music and dancing",
  "Guest experience",
  "Ceremony details",
  "Reception design",
  "Budget control",
  "Timeline flow",
  "Dress and attire",
  "Hair and makeup",
  "Open bar",
  "Late-night food",
  "Transportation",
  "Hotel blocks",
  "Cultural traditions",
  "Family moments",
  "Weather backup",
  "Accessibility",
  "Kids welcome",
  "After party",
];

const PRIORITY_COLUMNS: Array<{
  key: PlanningPriorityKey;
  title: string;
  shortTitle: string;
  description: string;
  activeClass: string;
  summaryClass: string;
  textClass: string;
}> = [
  {
    key: "mustHaves",
    title: "Must haves",
    shortTitle: "Must",
    description: "Non-negotiables for your day.",
    activeClass: "border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm",
    summaryClass: "border-emerald-200 bg-emerald-50/80",
    textClass: "text-emerald-700",
  },
  {
    key: "niceToHaves",
    title: "Nice to haves",
    shortTitle: "Nice",
    description: "Lovely extras if budget and timing allow.",
    activeClass: "border-amber-300 bg-amber-50 text-amber-900 shadow-sm",
    summaryClass: "border-amber-200 bg-amber-50/80",
    textClass: "text-amber-700",
  },
  {
    key: "mustAvoids",
    title: "Must avoids",
    shortTitle: "Avoid",
    description: "Things you do not want in the experience.",
    activeClass: "border-rose-300 bg-rose-50 text-rose-900 shadow-sm",
    summaryClass: "border-rose-200 bg-rose-50/80",
    textClass: "text-rose-700",
  },
];

const profileSchema = z.object({
  accountType: z.literal("couple_individual").default("couple_individual"),
  partner1Name: z.string().min(1, "Name is required"),
  partner2Name: z.string().min(1, "Name is required"),
  sharedLastName: z.string().min(1, "Last name is required"),
  weddingDate: z.string().min(1, "Date is required"),
  ceremonyTime: z.string().min(1, "Time is required"),
  receptionTime: z.string().min(1, "Time is required"),
  venueStatus: z.enum(["booked", "not_yet"]).default("booked"),
  venueDiscovery: z.custom<VenueDiscoveryData>().default(emptyVenueDiscoveryData),
  venue: z.string().optional().default(""),
  location: z.string().optional().default(""),
  venueCity: z.string().optional().default(""),
  venueState: z.string().optional().default(""),
  venueZip: z.string().optional().default(""),
  venueCountry: z.string().optional().default(""),
  ceremonyAtVenue: z.boolean().default(true),
  ceremonyVenueName: z.string().optional().default(""),
  ceremonyAddress: z.string().optional().default(""),
  ceremonyCity: z.string().optional().default(""),
  ceremonyState: z.string().optional().default(""),
  ceremonyZip: z.string().optional().default(""),
  guestCount: z.coerce.number().min(0, "Must be at least 0").default(0),
  totalBudget: z.coerce.number().min(0, "Must be at least 0").default(0),
  weddingVibe: z.string().optional().default(""),
  planningPriorities: planningPrioritiesSchema,
  preferredLanguage: z.string().default("English"),
}).superRefine((data, ctx) => {
  if (data.venueStatus === "booked" && !data.venue.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["venue"],
      message: "Venue is required when your venue is booked",
    });
  }
  if (data.venueStatus === "booked" && data.guestCount < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["guestCount"],
      message: "Must be at least 1",
    });
  }
  if (data.venueStatus === "booked" && data.totalBudget < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["totalBudget"],
      message: "Must be at least 1",
    });
  }
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function splitStoredCoupleNames(partner2Name?: string | null, partner1Name?: string | null) {
  const brideName = String(partner2Name ?? "").trim();
  const groomName = String(partner1Name ?? "").trim();
  const brideParts = brideName.split(/\s+/).filter(Boolean);
  const groomParts = groomName.split(/\s+/).filter(Boolean);
  const brideLast = brideParts.length > 1 ? brideParts[brideParts.length - 1] : "";
  const groomLast = groomParts.length > 1 ? groomParts[groomParts.length - 1] : "";
  const sharedLastName =
    brideLast && groomLast && brideLast.toLocaleLowerCase() === groomLast.toLocaleLowerCase()
      ? groomLast
      : !brideLast && groomLast
        ? groomLast
        : brideLast && !groomLast
          ? brideLast
          : "";

  const removeSharedLast = (name: string) => {
    if (!sharedLastName) return name;
    const suffix = new RegExp(`\\s+${sharedLastName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    return name.replace(suffix, "").trim();
  };

  return {
    partner2Name: removeSharedLast(brideName),
    partner1Name: removeSharedLast(groomName),
    sharedLastName,
  };
}

function prepareCoupleNames(values: ProfileFormValues) {
  const partner2First = values.partner2Name.trim();
  const partner1First = values.partner1Name.trim();
  const sharedLastName = values.sharedLastName.trim();
  return {
    partner2Name: partner2First,
    partner1Name: [partner1First, sharedLastName].filter(Boolean).join(" "),
  };
}

function normalizeVenueDiscovery(value?: VenueDiscoveryData | null): VenueDiscoveryData {
  const source = value ?? emptyVenueDiscoveryData;
  return {
    ...emptyVenueDiscoveryData,
    ...source,
    style: Array.isArray(source.style) ? source.style : [],
    requirements: normalizeRequirementsSelectorValue(source.requirements),
    shortlist: Array.isArray(source.shortlist) ? source.shortlist : [],
    screenshots: Array.isArray(source.screenshots) ? source.screenshots : [],
  };
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string") return null;

  const normalized = value.replace(/,/g, "").trim().toLowerCase();
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(k)?/);
  if (!match) return null;

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return match[2] ? parsed * 1000 : parsed;
}

function resolveHiddenProfileNumber(value: unknown, fallbackValue: unknown, minimum = 1) {
  return Math.max(minimum, parsePositiveNumber(value) ?? parsePositiveNumber(fallbackValue) ?? minimum);
}

function venueDiscoveryDraftForStorage(value?: VenueDiscoveryData | null): VenueDiscoveryData {
  return {
    ...normalizeVenueDiscovery(value),
    screenshots: [],
  };
}

function normalizeVenueStatus(value?: string | null): VenueStatus {
  return value === "not_yet" || value === "deciding" ? "not_yet" : "booked";
}

function normalizePlanningPriorities(value?: Partial<PlanningPriorities> | null): PlanningPriorities {
  const normalizeList = (items: unknown) =>
    Array.isArray(items)
      ? Array.from(new Set(items.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())))
      : [];

  const mustHaves = normalizeList(value?.mustHaves);
  const niceToHaves = normalizeList(value?.niceToHaves).filter((item) => !mustHaves.includes(item));
  const mustAvoids = normalizeList(value?.mustAvoids).filter((item) => !mustHaves.includes(item) && !niceToHaves.includes(item));

  return { mustHaves, niceToHaves, mustAvoids };
}

function getPriorityForOption(priorities: PlanningPriorities, option: string): PlanningPriorityKey | null {
  return PRIORITY_COLUMNS.find(({ key }) => priorities[key].includes(option))?.key ?? null;
}

function setPriorityForOption(priorities: PlanningPriorities, option: string, nextKey: PlanningPriorityKey): PlanningPriorities {
  const currentKey = getPriorityForOption(priorities, option);
  const next = PRIORITY_COLUMNS.reduce((acc, { key }) => {
    acc[key] = priorities[key].filter((item) => item !== option);
    return acc;
  }, { mustHaves: [], niceToHaves: [], mustAvoids: [] } as PlanningPriorities);

  if (currentKey !== nextKey) {
    next[nextKey] = [...next[nextKey], option];
  }

  return next;
}

function PlanningPrioritiesSummary({ priorities }: { priorities: PlanningPriorities }) {
  return (
    <div className="rounded-2xl border border-primary/15 bg-white/80 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-serif text-2xl text-primary">Priority chart</h3>
          <p className="text-sm text-muted-foreground">
            Your selected wedding priorities, grouped by how important they are.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PRIORITY_COLUMNS.map(({ key, title, description, summaryClass, textClass }) => {
          const items = priorities[key];
          return (
            <div key={key} className={cn("rounded-xl border p-4", summaryClass)}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className={cn("text-sm font-semibold uppercase tracking-wide", textClass)}>{title}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <span className={cn("rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold", textClass)}>
                  {items.length}
                </span>
              </div>
              {items.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <span key={item} className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg bg-white/70 px-3 py-3 text-sm text-muted-foreground">
                  Nothing selected yet.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type VenueFlowDraft = {
  venueStatus: VenueStatus;
  venueDiscovery: VenueDiscoveryData;
  updatedAt: number;
};

function getVenueDraftStorageKey(profileId?: string | number | null, userId?: string | null) {
  if (profileId != null) return `aido:venue-flow-draft:profile:${profileId}`;
  if (userId) return `aido:venue-flow-draft:user:${userId}`;
  return null;
}

function readVenueFlowDraft(key: string | null): VenueFlowDraft | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "null") as Partial<VenueFlowDraft> | null;
    if (!parsed || typeof parsed.updatedAt !== "number") return null;
    return {
      venueStatus: normalizeVenueStatus(parsed.venueStatus),
      venueDiscovery: normalizeVenueDiscovery(parsed.venueDiscovery),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function writeVenueFlowDraft(key: string | null, draft: VenueFlowDraft) {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({
      ...draft,
      venueDiscovery: venueDiscoveryDraftForStorage(draft.venueDiscovery),
    }));
  } catch {
    // Restricted browser storage should not block the profile form. The normal Save button still persists the full profile.
  }
}

function clearVenueFlowDraft(key: string | null) {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage in restricted browser modes.
  }
}

function getProfileUpdatedAtMs(profile?: { updatedAt?: string | null }) {
  const updatedAt = Date.parse(profile?.updatedAt ?? "");
  return Number.isFinite(updatedAt) ? updatedAt : 0;
}

export default function Profile() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { data: profile, isLoading, isFetching, isError, error, refetch } = useGetProfile({
    query: {
      queryKey: getGetProfileQueryKey(),
      enabled: isLoaded && !!isSignedIn,
      // Don't retry 404 — that just means "no profile yet, render the empty form".
      retry: (failureCount: number, err: unknown) => {
        if ((err as { status?: number } | null | undefined)?.status === 404) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000),
    }
  });
  // True 404 = brand-new user without a profile yet. We render the empty form
  // so they can fill it in (POST /api/profile creates the row on save).
  const isNoProfileYet = isError && (error as { status?: number } | null)?.status === 404;
  const saveProfile = useSaveProfile();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema) as unknown as Resolver<ProfileFormValues>,
    defaultValues: {
      partner1Name: "",
      accountType: "couple_individual",
      partner2Name: "",
      sharedLastName: "",
      weddingDate: "",
      ceremonyTime: "16:00",
      receptionTime: "18:00",
      venueStatus: "booked",
      venueDiscovery: emptyVenueDiscoveryData,
      venue: "",
      location: "",
      venueCity: "",
      venueState: "",
      venueZip: "",
      venueCountry: "",
      ceremonyAtVenue: true,
      ceremonyVenueName: "",
      ceremonyAddress: "",
      ceremonyCity: "",
      ceremonyState: "",
      ceremonyZip: "",
      guestCount: 100,
      totalBudget: 30000,
      weddingVibe: "",
      planningPriorities: emptyPlanningPriorities,
      preferredLanguage: "English",
    },
  });
  const profileId = (profile as { id?: string | number | null } | undefined)?.id;
  const venueDraftKey = getVenueDraftStorageKey(profileId, userId);
  const hasHydratedVenueDraftRef = useRef(false);

  useEffect(() => {
    if (profile) {
      const profileWithVenueFlow = profile as typeof profile & {
        venueStatus?: string | null;
        venueDiscovery?: VenueDiscoveryData | null;
        updatedAt?: string | null;
      };
      const draft = readVenueFlowDraft(venueDraftKey);
      const shouldUseDraft = !!draft && draft.updatedAt > getProfileUpdatedAtMs(profileWithVenueFlow);
      const coupleNameFields = splitStoredCoupleNames(profile.partner2Name, profile.partner1Name);
      form.reset({
        partner1Name: coupleNameFields.partner1Name,
        accountType: "couple_individual",
        partner2Name: coupleNameFields.partner2Name,
        sharedLastName: coupleNameFields.sharedLastName,
        weddingDate: (profile.weddingDate ?? "").split('T')[0],
        ceremonyTime: profile.ceremonyTime,
        receptionTime: profile.receptionTime,
        venueStatus: shouldUseDraft ? draft.venueStatus : normalizeVenueStatus(profileWithVenueFlow.venueStatus),
        venueDiscovery: shouldUseDraft ? draft.venueDiscovery : normalizeVenueDiscovery(profileWithVenueFlow.venueDiscovery),
        venue: profile.venue,
        location: profile.location,
        venueCity: profile.venueCity ?? "",
        venueState: profile.venueState ?? "",
        venueZip: profile.venueZip ?? "",
        venueCountry: (profile as { venueCountry?: string | null }).venueCountry ?? "",
        ceremonyAtVenue: profile.ceremonyAtVenue ?? true,
        ceremonyVenueName: profile.ceremonyVenueName ?? "",
        ceremonyAddress: profile.ceremonyAddress ?? "",
        ceremonyCity: profile.ceremonyCity ?? "",
        ceremonyState: profile.ceremonyState ?? "",
        ceremonyZip: profile.ceremonyZip ?? "",
        guestCount: profile.guestCount,
        totalBudget: profile.totalBudget,
        weddingVibe: profile.weddingVibe ?? "",
        planningPriorities: normalizePlanningPriorities(profile.planningPriorities),
        preferredLanguage: profile.preferredLanguage ?? "English",
      });
      hasHydratedVenueDraftRef.current = true;
    }
  }, [profile, form, venueDraftKey]);

  useEffect(() => {
    if (!isNoProfileYet || !venueDraftKey || hasHydratedVenueDraftRef.current) return;
    const draft = readVenueFlowDraft(venueDraftKey);
    if (draft) {
      form.reset({
        ...form.getValues(),
        venueStatus: draft.venueStatus,
        venueDiscovery: draft.venueDiscovery,
      });
    }
    hasHydratedVenueDraftRef.current = true;
  }, [form, isNoProfileYet, venueDraftKey]);

  useEffect(() => {
    if (!venueDraftKey) return;
    const subscription = form.watch((values, { name }) => {
      if (!hasHydratedVenueDraftRef.current) return;
      if (name && name !== "venueStatus" && name !== "venueDiscovery") return;

      const nextStatus = normalizeVenueStatus(values.venueStatus);
      writeVenueFlowDraft(venueDraftKey, {
        venueStatus: nextStatus,
        venueDiscovery: nextStatus === "booked"
          ? emptyVenueDiscoveryData
          : venueDiscoveryDraftForStorage(values.venueDiscovery as VenueDiscoveryData | undefined),
        updatedAt: Date.now(),
      });
    });

    return () => subscription.unsubscribe();
  }, [form, venueDraftKey]);

  const handleVenueStatusChange = useCallback((value: VenueStatus) => {
    form.setValue("venueStatus", value, { shouldDirty: true, shouldValidate: true });

    if (value === "booked") {
      form.setValue("venueDiscovery", emptyVenueDiscoveryData, { shouldDirty: true });
      writeVenueFlowDraft(venueDraftKey, {
        venueStatus: "booked",
        venueDiscovery: emptyVenueDiscoveryData,
        updatedAt: Date.now(),
      });
      return;
    }

    const currentDiscovery = normalizeVenueDiscovery(form.getValues("venueDiscovery"));
    form.setValue("venueDiscovery", currentDiscovery, { shouldDirty: true });
    writeVenueFlowDraft(venueDraftKey, {
      venueStatus: "not_yet",
      venueDiscovery: venueDiscoveryDraftForStorage(currentDiscovery),
      updatedAt: Date.now(),
    });
  }, [form, venueDraftKey]);

  const handleVenueDiscoveryChange = useCallback((value: VenueDiscoveryData) => {
    const normalizedDiscovery = normalizeVenueDiscovery(value);
    form.setValue("venueDiscovery", normalizedDiscovery, { shouldDirty: true });
    writeVenueFlowDraft(venueDraftKey, {
      venueStatus: "not_yet",
      venueDiscovery: venueDiscoveryDraftForStorage(normalizedDiscovery),
      updatedAt: Date.now(),
    });
  }, [form, venueDraftKey]);

  const onSubmit = (data: ProfileFormValues) => {
    const { sharedLastName, ...profileData } = data;
    const coupleNamesForSave = prepareCoupleNames({ ...data, sharedLastName });
    const profileDataForSave = data.venueStatus === "not_yet"
      ? {
        ...profileData,
        guestCount: Math.round(resolveHiddenProfileNumber(data.guestCount, data.venueDiscovery?.guestCount)),
        totalBudget: resolveHiddenProfileNumber(data.totalBudget, data.venueDiscovery?.budgetRange),
      }
      : profileData;
    saveProfile.mutate({ data: { ...profileDataForSave, ...coupleNamesForSave, accountType: "couple_individual" } }, {
      onSuccess: () => {
        clearVenueFlowDraft(venueDraftKey);
        toast({
          title: t("profile.saved_toast"),
          description: t("profile.saved_toast_desc"),
        });
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBudgetQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: t("common.error"),
          description: t("profile.save_error"),
        });
      }
    });
  };

  const venueStatus = form.watch("venueStatus");
  const brideFirstName = form.watch("partner2Name");
  const groomFirstName = form.watch("partner1Name");
  const sharedLastName = form.watch("sharedLastName");
  const coupleNames = [
    brideFirstName.trim(),
    [groomFirstName.trim(), sharedLastName.trim()].filter(Boolean).join(" "),
  ].filter(Boolean).join(" & ");
  const renderPlanningPrioritiesField = () => (
    <FormField
      control={form.control}
      name="planningPriorities"
      render={({ field }) => {
        const priorities = normalizePlanningPriorities(field.value);

        return (
          <FormItem>
            <div className="space-y-2">
              <FormLabel className="font-serif text-2xl text-primary">Wedding priorities</FormLabel>
              <p className="text-sm text-muted-foreground">
                Choose from one shared list. Tap Must, Nice, or Avoid to move each option into the right bucket.
              </p>
            </div>
            <FormControl>
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {WEDDING_PRIORITY_OPTIONS.map((option) => {
                    const activeKey = getPriorityForOption(priorities, option);
                    const activeColumn = PRIORITY_COLUMNS.find(({ key }) => key === activeKey);

                    return (
                      <div
                        key={option}
                        className={cn(
                          "rounded-2xl border border-primary/10 bg-white/85 p-3 shadow-sm transition-all",
                          activeColumn?.summaryClass,
                        )}
                      >
                        <div className="space-y-3">
                          <div className="min-w-0">
                            <p className="font-medium leading-snug text-foreground">{option}</p>
                            {activeColumn ? (
                              <p className={cn("mt-1 text-xs font-semibold uppercase tracking-wide", activeColumn.textClass)}>
                                Selected as {activeColumn.title}
                              </p>
                            ) : (
                              <p className="mt-1 text-xs text-muted-foreground">Not selected yet</p>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {PRIORITY_COLUMNS.map(({ key, shortTitle, activeClass }) => {
                              const isActive = activeKey === key;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => field.onChange(setPriorityForOption(priorities, option, key))}
                                  aria-pressed={isActive}
                                  className={cn(
                                    "rounded-full border border-primary/15 bg-white px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                                    isActive && activeClass,
                                  )}
                                >
                                  {shortTitle}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <PlanningPrioritiesSummary priorities={priorities} />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );

  // Only show the error screen for real errors (network/500). A 404 is the
  // expected "first-time user" state — fall through to render the empty form.
  if (isError && !profile && !isFetching && !isNoProfileYet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 text-center">
        <p className="text-muted-foreground text-sm">
          Could not load your profile. The server may be starting up — please try again.
        </p>
        <Button variant="outline" onClick={() => void refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  if (isLoading || (!profile && !isError)) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-4xl font-serif text-primary">
          {isNoProfileYet ? "Set up your wedding profile" : t("profile.title")}
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          {isNoProfileYet
            ? "Tell us a few quick details so Aria can personalize your planning experience."
            : t("profile.subtitle")}
        </p>
      </div>

      {isNoProfileYet && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <span className="font-medium text-primary">Welcome!</span>{" "}
          Fill in your wedding details below and tap <span className="font-medium">Save</span> at the bottom to get started.
        </div>
      )}

      <Card className="border-none shadow-md overflow-hidden bg-card">
        <CardHeader className="bg-primary/5 pb-6 border-b border-primary/10">
          <CardTitle className="font-serif text-2xl text-primary">{t("profile.your_details")}</CardTitle>
          <CardDescription>{t("profile.your_details_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="partner2Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.bride_first_name", { defaultValue: "Bride's First Name" })}</FormLabel>
                      <FormControl>
                        <Input placeholder="Your first name" {...field} data-testid="input-partner2" className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="partner1Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.groom_first_name", { defaultValue: "Groom's First Name" })}</FormLabel>
                      <FormControl>
                        <Input placeholder="Partner's first name" {...field} data-testid="input-partner1" className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="sharedLastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("profile.shared_last_name", { defaultValue: "Last Name Using" })}</FormLabel>
                    <FormControl>
                      <Input placeholder="Rivera" {...field} data-testid="input-shared-last-name" className="bg-background" />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {t("profile.shared_last_name_hint", { defaultValue: "This displays your names consistently across your website and invitations." })}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="weddingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.wedding_date")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type="date" {...field} data-testid="input-date" className="bg-background font-sans [color-scheme:light] dark:[color-scheme:dark]" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ceremonyTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.ceremony_time")}</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-ceremony-time" className="bg-background font-sans [color-scheme:light] dark:[color-scheme:dark]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receptionTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.reception_time")}</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-reception-time" className="bg-background font-sans [color-scheme:light] dark:[color-scheme:dark]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <VenueQuestion
                value={venueStatus}
                onChange={handleVenueStatusChange}
              />

              {venueStatus === "not_yet" && (
                <VenueWizard
                  value={form.watch("venueDiscovery")}
                  onChange={handleVenueDiscoveryChange}
                  coupleNames={coupleNames || undefined}
                  prioritiesSlot={renderPlanningPrioritiesField()}
                />
              )}

              {venueStatus === "booked" && (
                <>
                  <FormField
                    control={form.control}
                    name="venue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("profile.venue_name")}</FormLabel>
                        <FormControl>
                          <Input placeholder="The Historic Magnolia Estate" {...field} data-testid="input-venue" className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="venueCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("guests.country")}</FormLabel>
                        <Select
                          key={field.value || NO_COUNTRY}
                          value={field.value ? field.value : NO_COUNTRY}
                          onValueChange={(v) => field.onChange(v === NO_COUNTRY ? "" : v)}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background" data-testid="select-venue-country">
                              <SelectValue placeholder={t("guests.country_placeholder")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-72">
                            <SelectItem value={NO_COUNTRY}>{t("guests.country_none")}</SelectItem>
                            {COUNTRIES.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("profile.street_address")}</FormLabel>
                        <FormControl>
                          <AddressAutocomplete
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            country={form.watch("venueCountry")}
                            onSelect={(s) => {
                              field.onChange(s.street);
                              const fmt = getAddressFormat(form.watch("venueCountry"));
                              form.setValue("venueCity", s.city, { shouldDirty: true });
                              form.setValue("venueState", fmt.showState ? s.state : "", { shouldDirty: true });
                              form.setValue("venueZip", fmt.showZip ? s.zip : "", { shouldDirty: true });
                            }}
                            placeholder="123 Magnolia Lane"
                            id="input-location"
                            className="bg-background"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

              {(() => {
                const fmt = getAddressFormat(form.watch("venueCountry"));
                const visible = 1 + (fmt.showState ? 1 : 0) + (fmt.showZip ? 1 : 0);
                const gridCls = visible >= 3 ? "grid md:grid-cols-3 gap-6" : visible === 2 ? "grid md:grid-cols-2 gap-6" : "grid gap-6";
                return (
                  <div className={gridCls}>
                    {fmt.showState && (
                      <FormField
                        control={form.control}
                        name="venueState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{fmt.stateLabel}</FormLabel>
                            <FormControl>
                              <Input placeholder={fmt.statePlaceholder} {...field} data-testid="input-venue-state" className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={form.control}
                      name="venueCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{fmt.cityLabel}</FormLabel>
                          <FormControl>
                            <Input placeholder={fmt.cityPlaceholder} {...field} data-testid="input-venue-city" className="bg-background" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {fmt.showZip && (
                      <FormField
                        control={form.control}
                        name="venueZip"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{fmt.zipLabel}</FormLabel>
                            <FormControl>
                              <Input placeholder={fmt.zipPlaceholder} {...field} data-testid="input-venue-zip" className="bg-background" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                );
              })()}

              <div className="rounded-lg border border-primary/10 bg-primary/5 p-5 space-y-5">
                <FormField
                  control={form.control}
                  name="ceremonyAtVenue"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={!field.value}
                          onCheckedChange={(checked) => field.onChange(!checked)}
                          data-testid="checkbox-ceremony-at-venue"
                          className="mt-0.5"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-tight">
                        <FormLabel className="cursor-pointer">{t("profile.ceremony_at_venue")}</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          {t("profile.ceremony_at_venue_desc")}
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {!form.watch("ceremonyAtVenue") && (
                  <div className="space-y-4 pt-2 border-t border-primary/10">
                    <FormField
                      control={form.control}
                      name="ceremonyVenueName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("profile.ceremony_venue_name")}</FormLabel>
                          <FormControl>
                            <Input placeholder="St. Mary's Cathedral" {...field} data-testid="input-ceremony-venue-name" className="bg-background" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ceremonyAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("profile.ceremony_street_address")}</FormLabel>
                          <FormControl>
                            <AddressAutocomplete
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              country={form.watch("venueCountry")}
                              onSelect={(s) => {
                                field.onChange(s.street);
                                const fmt = getAddressFormat(form.watch("venueCountry"));
                                form.setValue("ceremonyCity", s.city, { shouldDirty: true });
                                form.setValue("ceremonyState", fmt.showState ? s.state : "", { shouldDirty: true });
                                form.setValue("ceremonyZip", fmt.showZip ? s.zip : "", { shouldDirty: true });
                              }}
                              placeholder="200 Broad Street"
                              id="input-ceremony-address"
                              className="bg-background"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {(() => {
                      const fmt = getAddressFormat(form.watch("venueCountry"));
                      const visible = 1 + (fmt.showState ? 1 : 0) + (fmt.showZip ? 1 : 0);
                      const gridCls = visible >= 3 ? "grid md:grid-cols-3 gap-4" : visible === 2 ? "grid md:grid-cols-2 gap-4" : "grid gap-4";
                      return (
                        <div className={gridCls}>
                          {fmt.showState && (
                            <FormField
                              control={form.control}
                              name="ceremonyState"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{fmt.stateLabel}</FormLabel>
                                  <FormControl>
                                    <Input placeholder={fmt.statePlaceholder} {...field} data-testid="input-ceremony-state" className="bg-background" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                          <FormField
                            control={form.control}
                            name="ceremonyCity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{fmt.cityLabel}</FormLabel>
                                <FormControl>
                                  <Input placeholder={fmt.cityPlaceholder} {...field} data-testid="input-ceremony-city" className="bg-background" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {fmt.showZip && (
                            <FormField
                              control={form.control}
                              name="ceremonyZip"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{fmt.zipLabel}</FormLabel>
                                  <FormControl>
                                    <Input placeholder={fmt.zipPlaceholder} {...field} data-testid="input-ceremony-zip" className="bg-background" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
                </>
              )}

              {venueStatus === "booked" && (
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="guestCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("profile.guest_count")}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-guests" className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="totalBudget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("profile.total_budget")}</FormLabel>
                        <FormControl>
                          <MoneyInput
                            value={field.value}
                            onValueChange={field.onChange}
                            onBlur={field.onBlur}
                            data-testid="input-budget"
                            className="bg-background"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    clearVenueFlowDraft(venueDraftKey);
                    form.reset({
                      accountType: "couple_individual",
                      partner1Name: "",
                      partner2Name: "",
                      sharedLastName: "",
                      weddingDate: "",
                      ceremonyTime: "",
                      receptionTime: "",
                      venueStatus: "booked",
                      venueDiscovery: emptyVenueDiscoveryData,
                      venue: "",
                      location: "",
                      venueCity: "",
                      venueState: "",
                      venueZip: "",
                      venueCountry: "",
                      ceremonyAtVenue: true,
                      ceremonyVenueName: "",
                      ceremonyAddress: "",
                      ceremonyCity: "",
                      ceremonyState: "",
                      ceremonyZip: "",
                      guestCount: 0,
                      totalBudget: 0,
                      weddingVibe: "",
                      planningPriorities: emptyPlanningPriorities,
                      preferredLanguage: "English",
                    });
                  }}
                  className="px-6"
                  data-testid="btn-reset-profile"
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    {t("profile.reset")}
                  </span>
                </Button>
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={saveProfile.isPending}
                  className="px-8 shadow-md"
                  data-testid="btn-save-profile"
                >
                  {saveProfile.isPending ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                      {t("profile.saving")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      {t("profile.save_details")}
                    </span>
                  )}
                </Button>
              </div>

            </form>
          </Form>
        </CardContent>
      </Card>

    </div>
  );
}
