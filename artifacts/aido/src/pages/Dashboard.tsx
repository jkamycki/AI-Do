import { useGetDashboardSummary } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useEffect, useMemo, useState, useRef } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { OnboardingWizard, useOnboardingWizard } from "@/components/OnboardingWizard";
import { authFetch } from "@/lib/authFetch";
import {
  CalendarDays,
  DollarSign,
  CheckSquare,
  Clock,
  Mail,
  Smartphone,
  ArrowRight,
  Sparkles,
  Heart,
  MapPin,
  AlertCircle,
  Users,
  UsersRound,
  AlertTriangle,
  Pencil,
  Gem,
  Hotel,
  ChevronRight,
  LayoutGrid,
  Building2,
  GripVertical,
  RotateCcw,
  Camera,
  Trash2,
  ImagePlus,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AvatarCropDialog } from "@/components/AvatarCropDialog";
import { useTranslation } from "react-i18next";

const API = import.meta.env.VITE_API_URL ?? "";

interface HotelBlock {
  id: number;
  hotelName: string;
  address?: string | null;
  phone?: string | null;
  bookingLink?: string | null;
  discountCode?: string | null;
  cutoffDate?: string | null;
  roomsReserved?: number | null;
  roomsBooked: number;
  pricePerNight?: number | null;
  distanceFromVenue?: string | null;
}

interface Vendor {
  id: number;
  name: string;
  category: string;
  email?: string | null;
  phone?: string | null;
  contractSigned?: boolean;
  isPaidOff?: boolean;
}

interface WeddingPartyMember {
  id: number;
  name: string;
  role: string;
  side: string;
}


function getGreetingKey() {
  const h = new Date().getHours();
  if (h < 12) return "dashboard.good_morning";
  if (h < 18) return "dashboard.good_afternoon";
  return "dashboard.good_evening";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatTime(timeStr: string | null | undefined) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function CountdownRing({ days }: { days: number }) {
  const { t } = useTranslation();
  const cap = 365;
  const pct = Math.max(0, Math.min(1, days / cap));
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct);

  return (
    <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-primary/10" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke="currentColor" strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
          className="text-primary transition-all duration-700"
        />
      </svg>
      <div className="text-center z-10">
        <div className="text-4xl font-serif font-bold text-primary leading-none">{days}</div>
        <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{t("dashboard.days_unit")}</div>
      </div>
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  sub,
  progress,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  progress?: number;
  href: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-card border border-border/60 rounded-2xl p-4 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
        <div className="flex items-center gap-2 text-muted-foreground mb-3">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        </div>
        <div className="text-2xl font-serif font-semibold text-foreground">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
        {progress !== undefined && (
          <Progress value={progress} className="h-1.5 mt-2.5" />
        )}
      </div>
    </Link>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  cta,
  ctaLabel,
  stat,
  accent = false,
  testId,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  cta: string;
  ctaLabel: string;
  stat?: React.ReactNode;
  accent?: boolean;
  testId?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl p-6 flex flex-col gap-4 overflow-hidden border transition-all duration-300 group
        ${accent
          ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20"
          : "bg-card border-border/60 hover:border-primary/30 hover:shadow-md"
        }`}
    >
      {accent && (
        <>
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-4 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
        </>
      )}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10
        ${accent ? "bg-white/20" : "bg-primary/10 group-hover:bg-primary/15 transition-colors"}`}>
        <Icon className={`h-5 w-5 ${accent ? "text-white" : "text-primary"}`} />
      </div>
      <div className="relative z-10 flex-1">
        <h3 className={`font-serif text-lg font-semibold mb-1 ${accent ? "text-white" : "text-foreground"}`}>{title}</h3>
        <p className={`text-sm leading-relaxed ${accent ? "text-white/75" : "text-muted-foreground"}`}>{description}</p>
        {stat && <div className="mt-3">{stat}</div>}
      </div>
      <Link href={cta} className="relative z-10">
        <Button
          size="sm"
          variant={accent ? "secondary" : "outline"}
          className={`w-full group-hover:gap-3 transition-all ${
            accent
              ? "bg-white/20 hover:bg-white/30 text-white border-white/20"
              : "border-primary/20 text-primary hover:bg-primary/5"
          }`}
          data-testid={testId}
        >
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </Link>
    </div>
  );
}

// ─── Generic draggable row used for any tile group on the dashboard ────────
function DraggableRow({
  storageKey,
  items,
  gridClassName,
  hint,
  showHint = false,
}: {
  storageKey: string;
  items: { id: string; node: React.ReactNode }[];
  gridClassName: string;
  hint?: string;
  showHint?: boolean;
}) {
  const defaultIds = useMemo(() => items.map((i) => i.id), [items]);

  const loadOrder = (): string[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaultIds;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return defaultIds;
      const filtered = parsed.filter((k: unknown): k is string => typeof k === "string" && defaultIds.includes(k));
      for (const id of defaultIds) if (!filtered.includes(id)) filtered.push(id);
      return filtered;
    } catch {
      return defaultIds;
    }
  };

  const [order, setOrder] = useState<string[]>(loadOrder);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Reconcile if the set of available items changes (e.g. card added/removed)
  useEffect(() => {
    setOrder((prev) => {
      const filtered = prev.filter((id) => defaultIds.includes(id));
      for (const id of defaultIds) if (!filtered.includes(id)) filtered.push(id);
      return filtered;
    });
  }, [defaultIds]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(order));
    } catch {
      /* ignore */
    }
  }, [order, storageKey]);

  const move = (from: string, to: string) => {
    if (from === to) return;
    setOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(from);
      const toIdx = next.indexOf(to);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, from);
      return next;
    });
  };

  const reset = () => setOrder(defaultIds);
  const isCustomized = order.join(",") !== defaultIds.join(",");
  const byId = new Map(items.map((i) => [i.id, i.node] as const));

  return (
    <div className="space-y-2">
      {(showHint || isCustomized) && (
        <div className="flex items-center justify-between px-1 min-h-[18px]">
          {showHint ? (
            <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
              <GripVertical className="h-3 w-3" /> {hint ?? "Drag any card to rearrange your dashboard"}
            </p>
          ) : (
            <span />
          )}
          {isCustomized && (
            <button
              onClick={reset}
              className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors ml-auto"
              data-testid={`btn-reset-${storageKey}`}
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
      )}
      <div className={gridClassName}>
        {order.map((id) => {
          const node = byId.get(id);
          if (!node) return null;
          const isDragging = draggingId === id;
          const isOver = overId === id && draggingId && draggingId !== id;
          return (
            <div
              key={id}
              draggable
              onDragStart={(e) => {
                setDraggingId(id);
                e.dataTransfer.effectAllowed = "move";
                try {
                  e.dataTransfer.setData("text/plain", id);
                } catch {
                  /* noop */
                }
              }}
              onDragOver={(e) => {
                if (!draggingId || draggingId === id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOverId(id);
              }}
              onDragEnter={(e) => {
                if (!draggingId || draggingId === id) return;
                e.preventDefault();
                setOverId(id);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget === e.target) setOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingId) move(draggingId, id);
                setDraggingId(null);
                setOverId(null);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setOverId(null);
              }}
              className={`relative transition-all cursor-grab active:cursor-grabbing ${
                isDragging ? "opacity-40 scale-[0.98]" : ""
              } ${isOver ? "ring-2 ring-primary/60 rounded-2xl" : ""}`}
              data-testid={`draggable-${storageKey}-${id}`}
            >
              {node}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type StatChipDef = {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  progress?: number;
  href: string;
};

const STAT_ORDER_KEY = "aido:dashboard:statOrder";
const DEFAULT_STAT_ORDER = ["budget", "checklist", "timeline", "guests"] as const;
type StatKey = typeof DEFAULT_STAT_ORDER[number];

function loadStatOrder(validKeys: string[]): StatKey[] {
  try {
    const raw = localStorage.getItem(STAT_ORDER_KEY);
    if (!raw) return [...DEFAULT_STAT_ORDER];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_STAT_ORDER];
    const filtered = parsed.filter((k) => validKeys.includes(k)) as StatKey[];
    // Append any keys missing from saved order (e.g. after we add new chips)
    for (const k of DEFAULT_STAT_ORDER) {
      if (!filtered.includes(k)) filtered.push(k);
    }
    return filtered.length ? filtered : [...DEFAULT_STAT_ORDER];
  } catch {
    return [...DEFAULT_STAT_ORDER];
  }
}

function DraggableStatsRow({ chips }: { chips: Record<StatKey, StatChipDef> }) {
  const validKeys = useMemo(() => Object.keys(chips), [chips]);
  const [order, setOrder] = useState<StatKey[]>(() => loadStatOrder(validKeys));
  const [draggingKey, setDraggingKey] = useState<StatKey | null>(null);
  const [dragOverKey, setDragOverKey] = useState<StatKey | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STAT_ORDER_KEY, JSON.stringify(order));
    } catch {
      /* ignore */
    }
  }, [order]);

  const move = (from: StatKey, to: StatKey) => {
    if (from === to) return;
    setOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(from);
      const toIdx = next.indexOf(to);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, from);
      return next;
    });
  };

  const reset = () => setOrder([...DEFAULT_STAT_ORDER]);
  const isCustomized = order.join(",") !== DEFAULT_STAT_ORDER.join(",");

  return (
    <div className="space-y-2">
      {isCustomized && (
        <div className="flex items-center justify-end px-1">
          <button
            onClick={reset}
            className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            data-testid="btn-reset-stat-order"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {order.map((key) => {
          const def = chips[key];
          if (!def) return null;
          const isDragging = draggingKey === key;
          const isOver = dragOverKey === key && draggingKey && draggingKey !== key;
          return (
            <div
              key={key}
              draggable
              onDragStart={(e) => {
                setDraggingKey(key);
                e.dataTransfer.effectAllowed = "move";
                try {
                  e.dataTransfer.setData("text/plain", key);
                } catch {
                  /* some browsers require this */
                }
              }}
              onDragOver={(e) => {
                if (!draggingKey || draggingKey === key) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverKey(key);
              }}
              onDragEnter={(e) => {
                if (!draggingKey || draggingKey === key) return;
                e.preventDefault();
                setDragOverKey(key);
              }}
              onDragLeave={(e) => {
                // Only clear if we actually leave the element (not its children)
                if (e.currentTarget === e.target) setDragOverKey(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingKey) move(draggingKey, key);
                setDraggingKey(null);
                setDragOverKey(null);
              }}
              onDragEnd={() => {
                setDraggingKey(null);
                setDragOverKey(null);
              }}
              className={`relative transition-all ${isDragging ? "opacity-40 scale-[0.98]" : ""} ${
                isOver ? "ring-2 ring-primary/60 rounded-2xl" : ""
              }`}
              data-testid={`stat-chip-${key}`}
            >
              <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 hover:opacity-100 text-muted-foreground/40 cursor-grab active:cursor-grabbing pointer-events-none">
                <GripVertical className="h-3.5 w-3.5" />
              </div>
              <StatChip {...def} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: summary, isLoading, isError } = useGetDashboardSummary();
  const { user } = useUser();
  const { activeWorkspace } = useWorkspace();
  const [, setLocation] = useLocation();
  const { data: hotels = [] } = useQuery<HotelBlock[]>({
    queryKey: ["hotels"],
    queryFn: async () => {
      const r = await authFetch(`${API}/api/hotels`);
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    },
    enabled: !!summary,
  });
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["vendors-dashboard"],
    queryFn: async () => {
      const r = await authFetch(`${API}/api/vendors`);
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    },
    enabled: !!summary,
  });
  const { data: weddingParty = [] } = useQuery<WeddingPartyMember[]>({
    queryKey: ["wedding-party-dashboard"],
    queryFn: async () => {
      const r = await authFetch(`${API}/api/wedding-party`);
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    },
    enabled: !!summary,
  });
  const { shouldShow: showOnboarding, dismiss: dismissOnboarding } = useOnboardingWizard(summary?.hasProfile ?? true);
  const { toast } = useToast();
  const picInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const handlePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max size is 10 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    if (picInputRef.current) picInputRef.current.value = "";
  };

  const handleCropConfirm = async (croppedFile: File) => {
    setCropSrc(null);
    if (!user) return;
    setUploadingPic(true);
    try {
      await user.setProfileImage({ file: croppedFile });
      toast({ title: "Profile picture updated!" });
    } catch {
      toast({ title: "Failed to update photo", variant: "destructive" });
    } finally {
      setUploadingPic(false);
    }
  };

  const handleRemovePic = async () => {
    if (!user) return;
    setUploadingPic(true);
    try {
      await user.setProfileImage({ file: null });
      toast({ title: "Profile picture removed" });
    } catch {
      toast({ title: "Failed to remove photo", variant: "destructive" });
    } finally {
      setUploadingPic(false);
    }
  };

  // Non-owner collaborators always land on the shared workspace, not their own dashboard
  useEffect(() => {
    if (activeWorkspace && activeWorkspace.role !== "owner" && !isLoading) {
      setLocation(`/workspace/${activeWorkspace.profileId}`);
    }
  }, [activeWorkspace, isLoading, setLocation]);
  if (activeWorkspace && activeWorkspace.role !== "owner" && !isLoading) {
    return null;
  }

  const firstName = user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ?? "there";

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-serif">{t("dashboard.something_went_wrong")}</h2>
        <p className="text-muted-foreground">{t("common.error")}</p>
        <Button onClick={() => window.location.reload()} data-testid="btn-retry">{t("dashboard.try_again")}</Button>
      </div>
    );
  }

  const budgetPct = summary.budgetTotal > 0
    ? Math.round((summary.budgetSpent / summary.budgetTotal) * 100)
    : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <OnboardingWizard open={showOnboarding} onDismiss={dismissOnboarding} />
      {cropSrc && (
        <AvatarCropDialog
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* Greeting */}
      <div>
        <p className="text-sm text-muted-foreground font-medium">{t(getGreetingKey())},</p>
        <div className="flex items-center gap-3 mt-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={uploadingPic}>
              <button
                type="button"
                className="relative flex-shrink-0 focus:outline-none disabled:opacity-70"
                title="Edit profile picture"
              >
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={firstName}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20 shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/15 ring-2 ring-primary/20 flex items-center justify-center shadow-sm">
                    <span className="text-primary font-semibold text-lg capitalize">{firstName[0]}</span>
                  </div>
                )}
                {uploadingPic ? (
                  <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center ring-2 ring-background">
                    <div className="h-2.5 w-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </span>
                ) : (
                  <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center ring-2 ring-background">
                    <Pencil className="h-2.5 w-2.5 text-white" />
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => picInputRef.current?.click()}
              >
                {user?.imageUrl
                  ? <><Camera className="h-4 w-4" /> Replace photo</>
                  : <><ImagePlus className="h-4 w-4" /> Add photo</>
                }
              </DropdownMenuItem>
              {user?.imageUrl && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                    onClick={handleRemovePic}
                  >
                    <Trash2 className="h-4 w-4" /> Remove photo
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <h1 className="text-3xl md:text-4xl font-serif text-foreground capitalize">
            {summary?.profile?.partner1Name && summary?.profile?.partner2Name
              ? `${summary.profile.partner1Name} & ${summary.profile.partner2Name}`
              : firstName} 🤍
          </h1>
        </div>
        <input
          ref={picInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={handlePicChange}
        />
        <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5 mt-2">
          <GripVertical className="h-3 w-3" /> {t("dashboard.drag_to_rearrange")}
        </p>
      </div>

      {/* Profile setup prompt */}
      {!summary.hasProfile && (
        <div className="rounded-2xl bg-primary/8 border border-primary/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t("profile.title")}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{t("profile.subtitle")}</p>
            </div>
          </div>
          <Link href="/profile" className="shrink-0">
            <Button size="sm" className="whitespace-nowrap" data-testid="btn-complete-profile">
              {t("dashboard.complete_profile")} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Wedding Profile Overview */}
      {summary.hasProfile && summary.profile ? (
        <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
          {/* Top gradient bar */}
          <div className="h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
          <div className="p-6">
            {/* Header row */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 text-primary mb-1">
                  <Heart className="h-4 w-4 fill-primary" />
                  <span className="text-xs font-semibold uppercase tracking-widest">{t("dashboard.your_wedding")}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-serif text-foreground">
                  {summary.profile.partner1Name} &amp; {summary.profile.partner2Name}
                </h2>
              </div>
              <Link href="/profile" className="shrink-0">
                <Button variant="outline" size="sm" className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5">
                  <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
                </Button>
              </Link>
            </div>

            {/* Details grid — drag to reorder */}
            <DraggableRow
              storageKey="aido:dashboard:weddingDetailsOrder"
              gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
              items={[
                {
                  id: "countdown",
                  node: (
                    <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/10 p-4 h-full">
                      <CountdownRing days={summary.daysUntilWedding} />
                    </div>
                  ),
                },
                {
                  id: "dateTime",
                  node: (
              <div className="rounded-xl bg-muted/30 border border-border/40 p-4 space-y-2.5 h-full">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t("dashboard.date_time_label")}</p>
                <div className="flex items-start gap-2">
                  <CalendarDays className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{formatDate(summary.profile.weddingDate)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[
                        summary.profile.ceremonyTime && t("dashboard.ceremony_at", { time: formatTime(summary.profile.ceremonyTime) }),
                        summary.profile.receptionTime && t("dashboard.reception_at", { time: formatTime(summary.profile.receptionTime) }),
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    summary.daysUntilWedding === 0
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                      : summary.daysUntilWedding <= 30
                      ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                      : "bg-primary/10 text-primary"
                  }`}>
                    {summary.daysUntilWedding === 0 ? t("dashboard.today") : t("dashboard.days_to_go_count", { n: summary.daysUntilWedding })}
                  </span>
                </div>
              </div>

                  ),
                },
                {
                  id: "venue",
                  node: (
              <div className="rounded-xl bg-muted/30 border border-border/40 p-4 space-y-2.5 h-full">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t("dashboard.venue_location")}</p>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{summary.profile.venue}</p>
                    {(() => {
                      const parts = [
                        summary.profile.location,
                        summary.profile.venueCity,
                        summary.profile.venueState,
                      ].filter(Boolean);
                      return parts.length > 0 ? (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug break-words">
                          {parts.join(", ")}
                        </p>
                      ) : null;
                    })()}
                  </div>
                </div>
                {hotels.length > 0 && (
                  <div className="flex items-start gap-2 pt-1 border-t border-border/30">
                    <Hotel className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground mb-1.5">{hotels.length > 1 ? t("dashboard.hotels_label") : t("dashboard.hotel_label")}</p>
                      <div className="flex flex-col gap-2">
                        {hotels.map(h => (
                          <div key={h.id}>
                            <p className="text-sm font-medium text-foreground">{h.hotelName || t("dashboard.unnamed_hotel")}</p>
                            {h.address && (
                              <p className="text-xs text-muted-foreground leading-snug break-words">{h.address}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

                  ),
                },
                {
                  id: "details",
                  node: (
              <div className="rounded-xl bg-muted/30 border border-border/40 p-4 space-y-2.5 h-full">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t("dashboard.details")}</p>
                <div className="flex items-center gap-2">
                  <UsersRound className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm text-foreground"><strong>{summary.profile.guestCount}</strong> {t("dashboard.expected_guests")}</span>
                </div>
                {summary.profile.weddingVibe && (
                  <div className="flex items-center gap-2">
                    <Gem className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm text-foreground capitalize">{summary.profile.weddingVibe}</span>
                  </div>
                )}
                {summary.profile.totalBudget > 0 && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm text-foreground">${summary.profile.totalBudget.toLocaleString()} {t("dashboard.budget").toLowerCase()}</span>
                  </div>
                )}
              </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
      ) : (
        /* No profile — simplified countdown */
        <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
          <div className="p-6 flex flex-col sm:flex-row items-center gap-6">
            <CountdownRing days={0} />
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-primary mb-1">
                <Heart className="h-4 w-4 fill-primary" />
                <span className="text-sm font-medium uppercase tracking-wider">{t("dashboard.until_wedding")}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-serif text-foreground">{t("dashboard.your_journey")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t("profile.subtitle")}</p>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
        </div>
      )}

      {/* Stats row — drag to reorder (single hint shown here for the whole dashboard) */}
      <DraggableStatsRow
        chips={{
          budget: {
            icon: DollarSign,
            label: t("dashboard.tile_budget"),
            value: `$${summary.budgetSpent.toLocaleString()}`,
            sub: `${t("dashboard.spent_of")} $${summary.budgetTotal.toLocaleString()}`,
            progress: budgetPct,
            href: "/budget",
          },
          checklist: {
            icon: CheckSquare,
            label: t("dashboard.tile_checklist"),
            value: `${summary.checklistCompleted}/${summary.checklistTotal}`,
            sub: `${Math.round(summary.checklistProgress)}% ${t("dashboard.completed")}`,
            progress: summary.checklistProgress,
            href: "/checklist",
          },
          timeline: {
            icon: Clock,
            label: t("dashboard.tile_timeline"),
            value: `${summary.timelineEventCount}`,
            sub: t("timeline.title"),
            href: "/timeline",
          },
          guests: {
            icon: UsersRound,
            label: t("dashboard.tile_guests"),
            value: `${summary.guestCount ?? 0}`,
            sub: `${(summary as any).guestRsvpSummary?.attending ?? 0} ${t("dashboard.rsvp_attending").toLowerCase()}`,
            href: "/guests",
          },
        }}
      />


      {/* Overview row: Guest RSVPs + Vendors + Wedding Party — drag to reorder */}
      <DraggableRow
        storageKey="aido:dashboard:overviewOrder"
        gridClassName="grid grid-cols-1 sm:grid-cols-3 gap-3"
        items={[
          {
            id: "rsvps",
            node: (
        <Link href="/guests">
          <div className="bg-card border border-border/60 rounded-2xl p-4 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">{t("dashboard.guest_rsvps")}</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
            {summary.guestCount > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /><span className="text-xs text-muted-foreground">{t("dashboard.rsvp_attending")}</span></div>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{(summary as any).guestRsvpSummary?.attending ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /><span className="text-xs text-muted-foreground">{t("dashboard.rsvp_declined")}</span></div>
                  <span className="text-sm font-semibold text-red-500 dark:text-red-400">{(summary as any).guestRsvpSummary?.declined ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /><span className="text-xs text-muted-foreground">{t("dashboard.rsvp_awaiting")}</span></div>
                  <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{(summary as any).guestRsvpSummary?.pending ?? 0}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden flex mt-1">
                  {((summary as any).guestRsvpSummary?.attending ?? 0) > 0 && (
                    <div className="h-full bg-emerald-500" style={{ width: `${((summary as any).guestRsvpSummary?.attending / summary.guestCount) * 100}%` }} />
                  )}
                  {((summary as any).guestRsvpSummary?.declined ?? 0) > 0 && (
                    <div className="h-full bg-red-400" style={{ width: `${((summary as any).guestRsvpSummary?.declined / summary.guestCount) * 100}%` }} />
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("dashboard.no_guests_added")}</p>
            )}
          </div>
        </Link>

            ),
          },
          {
            id: "vendors",
            node: (
        <Link href="/vendors">
          <div className="bg-card border border-border/60 rounded-2xl p-4 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">{t("dashboard.vendors")}</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
            {vendors.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-serif font-semibold text-foreground">{vendors.length}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium">
                    {vendors.filter(v => v.isPaidOff).length}/{vendors.length} paid
                  </span>
                </div>
                {vendors.slice(0, 3).map(v => (
                  <div key={v.id} className="flex items-center justify-between">
                    <span className="text-xs text-foreground truncate max-w-[120px]">{v.name}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">{v.category}</span>
                  </div>
                ))}
                {vendors.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">+{vendors.length - 3} more</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("dashboard.no_vendors_added")}</p>
            )}
          </div>
        </Link>

            ),
          },
          {
            id: "weddingParty",
            node: (
        <Link href="/wedding-party">
          <div className="bg-card border border-border/60 rounded-2xl p-4 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <LayoutGrid className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">{t("dashboard.wedding_party_label")}</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
            {weddingParty.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl font-serif font-semibold text-foreground">{weddingParty.length}</span>
                  <div className="text-xs text-muted-foreground leading-tight">
                    <div>{t("dashboard.bride_side_count", { n: weddingParty.filter(m => m.side === "bride").length })}</div>
                    <div>{t("dashboard.groom_side_count", { n: weddingParty.filter(m => m.side === "groom").length })}</div>
                  </div>
                </div>
                {weddingParty.slice(0, 3).map(m => (
                  <div key={m.id} className="flex items-center justify-between">
                    <span className="text-xs text-foreground truncate max-w-[120px]">{m.name}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">{m.role}</span>
                  </div>
                ))}
                {weddingParty.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">+{weddingParty.length - 3} more</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("dashboard.no_members_added")}</p>
            )}
          </div>
        </Link>
            ),
          },
        ]}
      />

      {/* Upcoming tasks alert */}
      {summary.upcomingTasks && summary.upcomingTasks.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-700/50 bg-amber-50/60 dark:bg-amber-900/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">{t("dashboard.needs_attention")}</span>
          </div>
          <div className="space-y-2">
            {summary.upcomingTasks.map(task => (
              <div key={task.id} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 flex-shrink-0 mt-2" />
                <div>
                  <span className="text-sm text-amber-900 dark:text-amber-200 font-medium">{task.task}</span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">{task.month}</span>
                </div>
              </div>
            ))}
          </div>
          <Link href="/checklist" className="mt-3 inline-block">
            <Button variant="outline" size="sm" className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 mt-2">
              {t("dashboard.continue_checklist")} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Feature Cards — drag to reorder */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">{t("dashboard.planning_tools")}</h2>
        <DraggableRow
          storageKey="aido:dashboard:planningToolsOrder"
          gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          items={[
            {
              id: "timeline",
              node: (
                <FeatureCard
                  icon={Clock}
                  title={t("dashboard.tile_timeline")}
                  description={t("features.timeline_desc")}
                  cta="/timeline"
                  ctaLabel={summary.hasTimeline ? t("dashboard.view_timeline") : t("dashboard.generate_timeline")}
                  stat={summary.hasTimeline
                    ? <div className="text-sm font-medium text-primary">{summary.timelineEventCount}</div>
                    : <div className="text-xs text-muted-foreground">{t("timeline.no_timeline_desc")}</div>
                  }
                  testId="btn-goto-timeline"
                />
              ),
            },
            {
              id: "budget",
              node: (
                <FeatureCard
                  icon={DollarSign}
                  title={t("nav.budget")}
                  description={t("features.budget_desc")}
                  cta="/budget"
                  ctaLabel={t("dashboard.manage_budget")}
                  stat={
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>${summary.budgetSpent.toLocaleString()}</span>
                        <span>{budgetPct}%</span>
                      </div>
                      <Progress value={budgetPct} className="h-1.5" />
                    </div>
                  }
                  testId="btn-goto-budget"
                />
              ),
            },
            {
              id: "checklist",
              node: (
                <FeatureCard
                  icon={CheckSquare}
                  title={t("dashboard.tile_checklist")}
                  description={t("features.checklist_desc")}
                  cta="/checklist"
                  ctaLabel={summary.hasChecklist ? t("dashboard.continue_checklist") : t("dashboard.create_checklist")}
                  stat={
                    summary.hasChecklist ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{t("checklist.completed_count", { done: summary.checklistCompleted, total: summary.checklistTotal })}</span>
                          <span>{Math.round(summary.checklistProgress)}%</span>
                        </div>
                        <Progress value={summary.checklistProgress} className="h-1.5" />
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">{t("dashboard.generate_personalized")}</div>
                    )
                  }
                  testId="btn-goto-checklist"
                />
              ),
            },
            {
              id: "guests",
              node: (
                <FeatureCard
                  icon={UsersRound}
                  title={t("dashboard.guest_list_title")}
                  description={t("guests.subtitle")}
                  cta="/guests"
                  ctaLabel={t("dashboard.manage_guests")}
                  stat={
                    summary.guestCount != null && summary.guestCount > 0
                      ? <div className="text-sm font-medium text-primary">{summary.guestCount}</div>
                      : <div className="text-xs text-muted-foreground">{t("dashboard.no_guests_added")}</div>
                  }
                  testId="btn-goto-guests"
                />
              ),
            },
            {
              id: "dayOf",
              node: (
                <FeatureCard
                  icon={Smartphone}
                  title={t("nav.dayof")}
                  description={t("dayof.subtitle")}
                  cta="/day-of"
                  ctaLabel={t("nav.dayof")}
                  accent
                  testId="btn-day-of-mode"
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
