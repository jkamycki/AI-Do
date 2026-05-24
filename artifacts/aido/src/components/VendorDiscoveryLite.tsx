import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCreateVendor,
  getGetDashboardSummaryQueryKey,
  getListVendorsQueryKey,
} from "@workspace/api-client-react";
import type { Vendor, WeddingProfile } from "@workspace/api-client-react";
import { authFetch } from "@/lib/authFetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  DollarSign,
  Globe,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DiscoveryVendor = {
  id: string;
  name: string;
  category: string;
  startingPrice?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
  source?: string;
  address?: string | null;
  whyMatches?: string[];
  questionsToAsk?: string[];
  negotiationTips?: string[];
};

type DiscoverySearchResponse = {
  results: DiscoveryVendor[];
  source: "google_places" | "not_configured" | "empty";
  suggestedCategories: string[];
  message?: string;
};

type DiscoveryMatchmakerResponse = {
  categories: Array<{
    category: string;
    recommendations: DiscoveryVendor[];
  }>;
  suggestedCategories: string[];
  source: "google_places" | "not_configured" | "empty";
  message?: string;
};

type DiscoveryContextResponse = {
  defaultLocation: string;
  defaultBudget: number | null;
  guestCount: number | null;
  vibe: string;
  suggestedCategories: string[];
  isPlacesConfigured?: boolean;
};

const VENDOR_CATEGORIES = [
  "Venue",
  "Caterer",
  "Photographer",
  "Videographer",
  "Florist",
  "DJ / Band",
  "Officiant",
  "Hair & Makeup",
  "Transportation",
  "Cake & Desserts",
  "Invitations",
  "Lighting & AV",
  "Photo Booth",
  "Wedding Planner",
  "Other",
] as const;

const CATEGORY_ACCENTS: Record<string, string> = {
  Venue: "bg-purple-50 text-purple-700 border-purple-200",
  Caterer: "bg-orange-50 text-orange-700 border-orange-200",
  Photographer: "bg-blue-50 text-blue-700 border-blue-200",
  Videographer: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Florist: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "DJ / Band": "bg-pink-50 text-pink-700 border-pink-200",
  Officiant: "bg-amber-50 text-amber-700 border-amber-200",
  "Hair & Makeup": "bg-rose-50 text-rose-700 border-rose-200",
  Transportation: "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Cake & Desserts": "bg-yellow-50 text-yellow-700 border-yellow-200",
  Invitations: "bg-lime-50 text-lime-700 border-lime-200",
  "Lighting & AV": "bg-violet-50 text-violet-700 border-violet-200",
  "Photo Booth": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  "Wedding Planner": "bg-teal-50 text-teal-700 border-teal-200",
  Other: "bg-slate-50 text-slate-700 border-slate-200",
};

const DEFAULT_SUGGESTIONS = ["Venue", "Photographer", "Caterer", "Florist", "DJ / Band"];

const vendorContactsQueryKey = ["vendor-contacts"] as const;

function normalizeCategory(category: string | null | undefined) {
  const raw = String(category ?? "").trim();
  if (/^dj\s*\/?\s*(band)?$/i.test(raw) || /^dj\s*\/\s*band$/i.test(raw)) return "DJ / Band";
  return VENDOR_CATEGORIES.find((cat) => cat.toLowerCase() === raw.toLowerCase()) ?? (raw || "Other");
}

function categoryClass(category: string) {
  return CATEGORY_ACCENTS[normalizeCategory(category)] ?? CATEGORY_ACCENTS.Other;
}

function formatBudget(value: string) {
  const n = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? `$${n.toLocaleString()}` : "";
}

function profileLocation(profile?: WeddingProfile | null) {
  if (!profile) return "";
  const cityState = [profile.venueCity, profile.venueState].filter(Boolean).join(", ");
  return cityState || profile.location || profile.venue || "";
}

function suggestedFromProgress(vendors: Vendor[], profile?: WeddingProfile | null) {
  const booked = new Set(vendors.map((vendor) => normalizeCategory(vendor.category)));
  const suggestions: string[] = [];
  if (profile?.venueStatus && profile.venueStatus !== "booked" && !booked.has("Venue")) {
    suggestions.push("Venue");
  }
  for (const category of DEFAULT_SUGGESTIONS) {
    if (!booked.has(category) && !suggestions.includes(category)) suggestions.push(category);
  }
  for (const category of VENDOR_CATEGORIES) {
    if (suggestions.length >= 6) break;
    if (category !== "Other" && !booked.has(category) && !suggestions.includes(category)) {
      suggestions.push(category);
    }
  }
  return suggestions;
}

function contactNote(vendor: DiscoveryVendor) {
  const lines = [
    "Added from Vendor Discovery Lite.",
    vendor.description ? `Description: ${vendor.description}` : "",
    vendor.startingPrice ? `Starting price: ${vendor.startingPrice}` : "",
    vendor.address ? `Public listing address: ${vendor.address}` : "",
    vendor.whyMatches?.length ? `Why this may match: ${vendor.whyMatches.join(" ")}` : "",
    vendor.questionsToAsk?.length ? `Questions to ask: ${vendor.questionsToAsk.join(" | ")}` : "",
    vendor.negotiationTips?.length ? `Negotiation tips: ${vendor.negotiationTips.join(" | ")}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

async function searchVendors(input: {
  location: string;
  category: string;
  budget: string;
  style: string;
  vibe: string;
  guestCount: number | null;
}) {
  const res = await authFetch("/api/vendors/discovery/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Vendor discovery search failed");
  return res.json() as Promise<DiscoverySearchResponse>;
}

async function fetchDiscoveryContext() {
  const res = await authFetch("/api/vendors/discovery/context");
  if (!res.ok) throw new Error("Vendor discovery context failed");
  return res.json() as Promise<DiscoveryContextResponse>;
}

async function runMatchmaker(input: {
  location: string;
  categories: string[];
  budget: string;
  style: string;
  vibe: string;
  guestCount: number | null;
}) {
  const res = await authFetch("/api/vendors/discovery/matchmaker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("AI vendor matchmaker failed");
  return res.json() as Promise<DiscoveryMatchmakerResponse>;
}

function VendorDiscoveryCard({
  vendor,
  added,
  adding,
  onAdd,
}: {
  vendor: DiscoveryVendor;
  added: boolean;
  adding: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#F0D2D9] bg-white/90 p-5 shadow-[0_14px_34px_rgba(141,41,77,0.07)] transition-all hover:-translate-y-0.5 hover:border-[#D4A373]/70 hover:shadow-[0_18px_44px_rgba(141,41,77,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-xl font-semibold text-[#3B1C2B]">{vendor.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("rounded-full border px-2.5 py-0.5", categoryClass(vendor.category))}>
              {normalizeCategory(vendor.category)}
            </Badge>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#8D6A73]">
              <DollarSign className="h-3.5 w-3.5 text-[#D4A373]" />
              {vendor.startingPrice || "Ask for pricing"}
            </span>
          </div>
        </div>
      </div>

      {vendor.description && (
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-[#6F5860]">{vendor.description}</p>
      )}

      <div className="mt-4 space-y-2 text-sm text-[#6F5860]">
        {vendor.address && (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A373]" />
            <span>{vendor.address}</span>
          </p>
        )}
        {vendor.phone && (
          <a className="flex items-center gap-2 hover:text-[#8D294D]" href={`tel:${vendor.phone.replace(/[^\d+]/g, "")}`}>
            <Phone className="h-4 w-4 shrink-0 text-[#D4A373]" />
            <span>{vendor.phone}</span>
          </a>
        )}
      </div>

      {vendor.whyMatches?.length ? (
        <div className="mt-4 rounded-xl border border-[#F0D2D9] bg-[#FFF8F5] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8D294D]">Why this matches you</p>
          <ul className="mt-2 space-y-1.5 text-sm text-[#4A3039]">
            {vendor.whyMatches.slice(0, 3).map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {vendor.questionsToAsk?.length || vendor.negotiationTips?.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {vendor.questionsToAsk?.length ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8D294D]">Ask</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5 text-[#6F5860]">
                {vendor.questionsToAsk.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}
          {vendor.negotiationTips?.length ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8D294D]">Negotiate</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5 text-[#6F5860]">
                {vendor.negotiationTips.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {vendor.website && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-[#E8C9D0] text-[#8D294D] hover:bg-[#F7DDE2]"
            asChild
          >
            <a href={vendor.website} target="_blank" rel="noopener noreferrer">
              <Globe className="mr-1.5 h-3.5 w-3.5" />
              Website
            </a>
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={onAdd}
          disabled={adding || added}
          className="rounded-full bg-[#8D294D] text-white hover:bg-[#7A2442]"
        >
          {adding ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : added ? (
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
          ) : (
            <Plus className="mr-1.5 h-3.5 w-3.5" />
          )}
          {added ? "Added" : "Add to My Vendors"}
        </Button>
      </div>
    </div>
  );
}

export function VendorDiscoveryLite({
  vendors,
  profile,
}: {
  vendors: Vendor[];
  profile?: WeddingProfile | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const contextQuery = useQuery({
    queryKey: ["vendor-discovery-context"],
    queryFn: fetchDiscoveryContext,
    staleTime: 60_000,
  });
  const suggested = useMemo(() => {
    const serverSuggestions = contextQuery.data?.suggestedCategories ?? [];
    const localSuggestions = suggestedFromProgress(vendors, profile);
    return Array.from(new Set([...serverSuggestions, ...localSuggestions])).slice(0, 6);
  }, [contextQuery.data?.suggestedCategories, vendors, profile]);
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [budget, setBudget] = useState("");
  const [style, setStyle] = useState("");
  const [vibe, setVibe] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchData, setSearchData] = useState<DiscoverySearchResponse | null>(null);
  const [matchData, setMatchData] = useState<DiscoveryMatchmakerResponse | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [hasAppliedDefaults, setHasAppliedDefaults] = useState(false);

  useEffect(() => {
    if (hasAppliedDefaults) return;
    const defaultLocation = contextQuery.data?.defaultLocation || profileLocation(profile);
    const defaultBudget = contextQuery.data?.defaultBudget ? String(contextQuery.data.defaultBudget) : "";
    const defaultGuestCount = contextQuery.data?.guestCount || profile?.guestCount;
    const defaultVibe = contextQuery.data?.vibe || profile?.weddingVibe || "";
    const defaultCategories = suggested.length ? suggested : DEFAULT_SUGGESTIONS;

    if (!defaultLocation && !defaultBudget && !defaultGuestCount && !defaultVibe && suggested.length === 0 && contextQuery.isLoading) {
      return;
    }

    setLocation((current) => current || defaultLocation);
    setBudget((current) => current || defaultBudget);
    setGuestCount((current) => current || (defaultGuestCount ? String(defaultGuestCount) : ""));
    setVibe((current) => current || defaultVibe);
    setCategory((current) => current || defaultCategories[0] || "Photographer");
    setSelectedCategories((current) => current.length ? current : defaultCategories.slice(0, 3));
    setHasAppliedDefaults(true);
  }, [contextQuery.data, contextQuery.isLoading, hasAppliedDefaults, profile, suggested]);

  const createVendor = useCreateVendor({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        qc.invalidateQueries({ queryKey: vendorContactsQueryKey });
        qc.invalidateQueries({ queryKey: ["vendor-financials"] });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Vendor added to your planning dashboard" });
      },
      onError: (err: unknown) => {
        const apiErr = err as { data?: { error?: string } } | undefined;
        toast({
          title: "Could not add vendor",
          description: apiErr?.data?.error,
          variant: "destructive",
        });
      },
    },
  });

  const searchMutation = useMutation({
    mutationFn: searchVendors,
    onSuccess: (data) => {
      setSearchData(data);
      setMatchData(null);
      if (data.suggestedCategories.length > 0) {
        setSelectedCategories((current) => current.length > 0 ? current : data.suggestedCategories.slice(0, 3));
      }
    },
    onError: () => toast({ title: "Vendor search failed", variant: "destructive" }),
  });

  const matchMutation = useMutation({
    mutationFn: runMatchmaker,
    onSuccess: (data) => {
      setMatchData(data);
      setSearchData(null);
    },
    onError: () => toast({ title: "AI matchmaker failed", variant: "destructive" }),
  });

  const allResults = matchData
    ? matchData.categories.flatMap((group) => group.recommendations)
    : searchData?.results ?? [];

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    searchMutation.mutate({
      location,
      category: category || suggested[0] || "Photographer",
      budget,
      style,
      vibe,
      guestCount: guestCount ? Number(guestCount) : null,
    });
  }

  function handleMatchmaker() {
    const categories = selectedCategories.length > 0 ? selectedCategories : [category || suggested[0] || "Photographer"];
    matchMutation.mutate({
      location,
      categories,
      budget,
      style,
      vibe,
      guestCount: guestCount ? Number(guestCount) : null,
    });
  }

  function toggleCategory(nextCategory: string) {
    setCategory(nextCategory);
    setSelectedCategories((current) => {
      if (current.includes(nextCategory)) return current.filter((item) => item !== nextCategory);
      return [...current, nextCategory].slice(-5);
    });
  }

  function addVendor(vendor: DiscoveryVendor) {
    createVendor.mutate({
      data: {
        name: vendor.name,
        category: normalizeCategory(vendor.category),
        email: vendor.email || undefined,
        phone: vendor.phone || undefined,
        website: vendor.website || undefined,
        notes: contactNote(vendor),
      },
    }, {
      onSuccess: () => {
        setAddedIds((current) => new Set([...current, vendor.id]));
      },
    });
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-[#F0D2D9] bg-[#FFF8F5] p-5 shadow-[0_20px_50px_rgba(141,41,77,0.08)] sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#D4A373]/40 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#8D294D]">
              <Search className="h-3.5 w-3.5 text-[#D4A373]" />
              Vendor Discovery Lite
            </div>
            <h2 className="font-serif text-3xl font-semibold text-[#3B1C2B]">Find options, then save only what you need.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7A5261]">
              Lightweight public-data discovery for couple planning. No vendor accounts, no reviews, no featured placements, and no marketplace clutter.
            </p>
          </div>
          <div className="rounded-2xl border border-[#F0D2D9] bg-white/80 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8D294D]">Suggested next</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggested.slice(0, 5).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleCategory(item)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                    selectedCategories.includes(item)
                      ? "border-[#8D294D] bg-[#F7DDE2] text-[#3B1C2B]"
                      : "border-[#E8C9D0] bg-white text-[#7A5261] hover:border-[#D4A373]",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSearch} className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="vendor-discovery-location">Location</Label>
            <Input
              id="vendor-discovery-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Austin, TX"
              className="h-11 rounded-xl border-[#E8C9D0] bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-discovery-category">Category</Label>
            <Input
              id="vendor-discovery-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Photographer, venue, florist..."
              className="h-11 rounded-xl border-[#E8C9D0] bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-discovery-budget">Budget</Label>
            <Input
              id="vendor-discovery-budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 3500"
              className="h-11 rounded-xl border-[#E8C9D0] bg-white"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              disabled={searchMutation.isPending}
              className="h-11 w-full rounded-xl bg-[#8D294D] px-5 text-white hover:bg-[#7A2442]"
            >
              {searchMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search
            </Button>
          </div>
        </form>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="space-y-1.5 lg:col-span-1">
            <Label htmlFor="vendor-discovery-style">Style</Label>
            <Input
              id="vendor-discovery-style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="modern, garden, editorial..."
              className="rounded-xl border-[#E8C9D0] bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-discovery-vibe">Vibe</Label>
            <Input
              id="vendor-discovery-vibe"
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              placeholder="romantic, calm, high-energy..."
              className="rounded-xl border-[#E8C9D0] bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-discovery-guests">Guest count</Label>
            <Input
              id="vendor-discovery-guests"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="150"
              inputMode="numeric"
              className="rounded-xl border-[#E8C9D0] bg-white"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {VENDOR_CATEGORIES.filter((item) => item !== "Other").slice(0, 10).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => toggleCategory(item)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                  selectedCategories.includes(item)
                    ? "border-[#8D294D] bg-[#F7DDE2] text-[#3B1C2B]"
                    : "border-[#E8C9D0] bg-white text-[#7A5261] hover:border-[#D4A373]",
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleMatchmaker}
            disabled={matchMutation.isPending}
            className="rounded-full border-[#D4A373]/60 bg-white text-[#8D294D] hover:bg-[#FFF3D8]"
          >
            {matchMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-[#D4A373]" />}
            AI Vendor Matchmaker
          </Button>
        </div>
      </section>

      {(searchData?.message || matchData?.message) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {searchData?.message || matchData?.message}
        </div>
      )}

      {allResults.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-[#E8C9D0] bg-white/70 p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-[#D4A373]" />
          <h3 className="mt-3 font-serif text-2xl text-[#3B1C2B]">Start with a simple search.</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#7A5261]">
            Search a category near your wedding location, or let the matchmaker compare categories based on your budget, style, vibe, and guest count.
          </p>
        </div>
      ) : matchData ? (
        <div className="space-y-7">
          {matchData.categories.map((group) => (
            <section key={group.category} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-2xl font-semibold text-[#3B1C2B]">{group.category}</h3>
                <span className="text-sm text-[#8D6A73]">{group.recommendations.length} matches</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {group.recommendations.map((vendor) => (
                  <VendorDiscoveryCard
                    key={`${group.category}-${vendor.id}`}
                    vendor={vendor}
                    added={addedIds.has(vendor.id)}
                    adding={createVendor.isPending}
                    onAdd={() => addVendor(vendor)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-2xl font-semibold text-[#3B1C2B]">Discovery Results</h3>
            <span className="text-sm text-[#8D6A73]">{allResults.length} public listings</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {allResults.map((vendor) => (
              <VendorDiscoveryCard
                key={vendor.id}
                vendor={vendor}
                added={addedIds.has(vendor.id)}
                adding={createVendor.isPending}
                onAdd={() => addVendor(vendor)}
              />
            ))}
          </div>
        </section>
      )}

      <div className="rounded-2xl border border-[#F0D2D9] bg-white/80 p-4 text-xs leading-5 text-[#7A5261]">
        <p className="font-semibold text-[#3B1C2B]">Discovery Lite boundaries</p>
        <p className="mt-1">
          Results come from public listing data when a Places API key is configured. A.I Do does not host vendor profiles, collect vendor reviews, sell placements, or create vendor logins. Saving a result only adds a private planning note to your own vendor list.
        </p>
      </div>
    </div>
  );
}
