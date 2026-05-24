import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser, useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace, type WorkspaceInfo } from "@/contexts/WorkspaceContext";
import { useTranslation } from "react-i18next";
import {
  Heart,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Users,
  Sparkles,
  Camera,
  ImagePlus,
  Trash2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";
import { useTracking } from "@/hooks/useTracking";

const AvatarCropDialog = lazy(() =>
  import("@/components/AvatarCropDialog").then((mod) => ({ default: mod.AvatarCropDialog })),
);

const routePrefetchers: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("@/pages/Dashboard"),
  "/profile": () => import("@/pages/Profile"),
  "/mood-board": () => import("@/pages/MoodBoard"),
  "/timeline": () => import("@/pages/Timeline"),
  "/checklist": () => import("@/pages/Checklist"),
  "/vendors": () => import("@/pages/Vendors"),
  "/budget": () => import("@/pages/Budget"),
  "/documents": () => import("@/pages/DocumentLibrary"),
  "/guests": () => import("@/pages/GuestListAndInvitations"),
  "/wedding-party": () => import("@/pages/WeddingParty"),
  "/seating-chart": () => import("@/pages/SeatingChart"),
  "/hotels": () => import("@/pages/Hotels"),
  "/aria": () => import("@/pages/Aria"),
  "/day-of": () => import("@/pages/DayOf"),
  "/website-editor": () => import("@/pages/WebsiteEditor"),
  "/settings": () => import("@/pages/Settings"),
  "/help": () => import("@/pages/Help"),
  "/help/updates-improvements": () => import("@/pages/UpdatesImprovements"),
  "/operations-center": () => import("@/pages/OperationsCenter"),
};

const prefetchedRoutes = new Set<string>();

function prefetchSidebarRoute(href: string) {
  if (prefetchedRoutes.has(href)) return;
  if (typeof navigator !== "undefined" && navigator.connection?.saveData) return;
  const load = routePrefetchers[href];
  if (!load) return;
  prefetchedRoutes.add(href);
  void load().catch(() => prefetchedRoutes.delete(href));
}

interface WorkspacesData {
  ownProfile: {
    profileId: number;
    workstationName?: string | null;
    partner1Name: string;
    partner2Name: string;
    weddingDate: string;
    accountType?: string;
  } | null;
  ownWorkspaces?: Array<{
    profileId: number;
    role: string;
    workstationName?: string | null;
    partner1Name: string;
    partner2Name: string;
    weddingDate: string;
    accountType?: string;
  }>;
  accountType?: string;
  sharedWorkspaces: Array<{
    id: number;
    profileId: number;
    role: string;
    status: string;
    workstationName?: string | null;
    partner1Name: string;
    partner2Name: string;
    weddingDate: string;
  }>;
}

function WorkspaceSwitcher({ onClose }: { onClose: () => void }) {
  const { isSignedIn } = useAuth();
  const { activeWorkspace, setActiveWorkspace } = useWorkspace();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  const { data } = useQuery<WorkspacesData>({
    queryKey: ["my-workspaces"],
    queryFn: async () => {
      const r = await authFetch("/api/collaborators/my-workspaces");
      if (!r.ok) return { ownProfile: null, sharedWorkspaces: [] };
      return r.json();
    },
    enabled: !!isSignedIn,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const sharedWorkspaces = data?.sharedWorkspaces ?? [];
  const ownWorkspaces = data?.ownProfile ? [{ ...data.ownProfile, role: "owner" }] : [];

  const workspaceLabel = (ws: { workstationName?: string | null; partner1Name: string; partner2Name: string }) =>
    ws.workstationName?.trim() || `${ws.partner2Name} & ${ws.partner1Name}`;

  if (sharedWorkspaces.length === 0) return null;

  const currentLabel = activeWorkspace
    ? workspaceLabel(activeWorkspace)
    : t("sidebar.my_workspace");

  const handleSelectOwn = () => {
    setActiveWorkspace(null);
    setOpen(false);
    setLocation("/dashboard");
    onClose();
  };

  const handleSelectOwned = (ws: NonNullable<WorkspacesData["ownWorkspaces"]>[0]) => {
    if (data?.ownProfile?.profileId === ws.profileId) {
      handleSelectOwn();
      return;
    }
    setActiveWorkspace({
      profileId: ws.profileId,
      workstationName: ws.workstationName,
      partner1Name: ws.partner1Name,
      partner2Name: ws.partner2Name,
      weddingDate: ws.weddingDate,
      role: "owner",
    });
    setOpen(false);
    setLocation("/dashboard");
    onClose();
  };

  const handleSelectShared = (ws: WorkspacesData["sharedWorkspaces"][0]) => {
    const info: WorkspaceInfo = {
      profileId: ws.profileId,
      workstationName: ws.workstationName,
      partner1Name: ws.partner1Name,
      partner2Name: ws.partner2Name,
      weddingDate: ws.weddingDate,
      role: ws.role,
    };
    setActiveWorkspace(info);
    setOpen(false);
    setLocation(`/workspace/${ws.profileId}`);
    onClose();
  };

  return (
    <div className="px-4 pb-2 relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15 hover:bg-primary/10 transition-colors text-left"
      >
        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          {activeWorkspace ? (
            <Users className="h-3 w-3 text-primary" />
          ) : (
            <Heart className="h-3 w-3 text-primary" />
          )}
        </div>
        <span className="text-xs font-medium text-foreground flex-1 truncate">{currentLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-4 right-4 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1.5 overflow-hidden">
          <p className="px-3 py-1 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            {t("sidebar.workspaces_label")}
          </p>
          {ownWorkspaces.map((ws) => {
            const isDefault = data?.ownProfile?.profileId === ws.profileId;
            const isActive = isDefault ? !activeWorkspace : activeWorkspace?.profileId === ws.profileId;
            return (
              <div
                key={ws.profileId}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left
                  ${isActive ? "text-primary font-medium" : "text-foreground"}`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectOwned(ws)}
                  className="flex flex-1 min-w-0 items-center gap-2.5 text-left"
                >
                  <Heart className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{isDefault ? t("sidebar.my_workspace") : workspaceLabel(ws)}</div>
                  </div>
                </button>
                {isActive && <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{t("sidebar.active")}</span>}
              </div>
            );
          })}
          {sharedWorkspaces.length > 0 && (
            <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
              {t("sidebar.shared_with_me", { defaultValue: "Shared with me" })}
            </p>
          )}
          {sharedWorkspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => handleSelectShared(ws)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left
                ${activeWorkspace?.profileId === ws.profileId ? "text-primary font-medium" : "text-foreground"}`}
            >
              <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{ws.partner2Name} & {ws.partner1Name}</div>
                <div className="text-[10px] text-muted-foreground capitalize">{ws.role}</div>
              </div>
              {activeWorkspace?.profileId === ws.profileId && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0">{t("sidebar.active")}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const { isSignedIn } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { track } = useTracking();
  const picInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const isPlannerOwnWorkspace = false;

  const handlePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t("sidebar.file_too_large", { defaultValue: "File too large" }),
        description: t("sidebar.file_too_large_desc", { defaultValue: "Max size is 10 MB." }),
        variant: "destructive",
      });
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
      toast({ title: t("sidebar.profile_picture_updated", { defaultValue: "Profile picture updated!" }) });
    } catch {
      toast({ title: t("sidebar.profile_picture_update_failed", { defaultValue: "Failed to update photo" }), variant: "destructive" });
    } finally {
      setUploadingPic(false);
    }
  };

  const handleRemovePic = async () => {
    if (!user) return;
    setUploadingPic(true);
    try {
      await user.setProfileImage({ file: null });
      toast({ title: t("sidebar.profile_picture_removed", { defaultValue: "Profile picture removed" }) });
    } catch {
      toast({ title: t("sidebar.profile_picture_remove_failed", { defaultValue: "Failed to remove photo" }), variant: "destructive" });
    } finally {
      setUploadingPic(false);
    }
  };

  const firstName = user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ?? "";

  const { data: adminCheck } = useQuery({
    queryKey: ["admin-check"],
    queryFn: async () => {
      const r = await authFetch("/api/admin/check");
      if (!r.ok) return { isAdmin: false };
      return r.json() as Promise<{ isAdmin: boolean }>;
    },
    enabled: !!isSignedIn,
    staleTime: 0,
    retry: false,
  });

  const isAdmin = adminCheck?.isAdmin === true;

  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    const warmRoutes = ["/dashboard", "/profile", "/budget", "/vendors", "/guests", "/timeline", "/checklist"];
    const warm = () => warmRoutes.forEach(prefetchSidebarRoute);
    const idleId =
      "requestIdleCallback" in window
        ? window.requestIdleCallback(warm, { timeout: 5000 })
        : window.setTimeout(warm, 1800);
    return () => {
      if ("cancelIdleCallback" in window && typeof idleId === "number") {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, [isSignedIn]);

  // Restore sidebar scroll position whenever the route changes,
  // so clicking a nav link doesn't snap the menu back to the top.
  useEffect(() => {
    const el = sidebarScrollRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem("aido_sidebar_scroll");
    const top = saved ? parseInt(saved, 10) : 0;
    if (!isNaN(top)) {
      // Use rAF so we set scrollTop after layout is committed.
      requestAnimationFrame(() => {
        el.scrollTop = top;
      });
    }
  }, [location]);

  const handleSignOut = () => {
    signOut({ redirectUrl: "/sign-in" });
  };

  const closeMenu = () => setIsOpen(false);

  const sidebarSections = [
    {
      id: "planning",
      label: t("nav.planning", { defaultValue: "Planning" }),
      defaultOpen: true,
      items: [
        { href: "/dashboard", label: t("sidebar.overview", { defaultValue: "Overview" }) },
        { href: "/checklist", label: t("sidebar.tasks", { defaultValue: "Tasks" }) },
        { href: "/mood-board", label: t("sidebar.vision_board", { defaultValue: "Vision Board" }) },
        { href: "/profile", label: t("nav.profile", { defaultValue: "Wedding Profile" }) },
        { href: "/timeline", label: t("nav.timeline", { defaultValue: "Timeline" }) },
      ],
    },
    {
      id: "vendors",
      label: t("sidebar.vendors_section", { defaultValue: "Vendors" }),
      defaultOpen: true,
      items: [
        { href: "/vendors", label: t("sidebar.my_vendors", { defaultValue: "My Vendors" }) },
        { href: "/budget", label: t("sidebar.budget_summary", { defaultValue: "Budget Summary" }) },
        { href: "/documents", label: t("sidebar.vendor_files", { defaultValue: "Vendor Files" }) },
      ],
    },
    {
      id: "people",
      label: t("sidebar.people_section", { defaultValue: "People" }),
      defaultOpen: false,
      items: [
        { href: "/guests", label: t("nav.guests", { defaultValue: "Guest List & Invitations" }) },
        { href: "/wedding-party", label: t("nav.party", { defaultValue: "Wedding Party" }) },
        { href: "/seating-chart", label: t("nav.seating", { defaultValue: "Seating Chart" }) },
        { href: "/hotels", label: t("nav.hotels", { defaultValue: "Hotel Blocks" }) },
      ],
    },
    {
      id: "day-of",
      label: t("sidebar.day_of_section", { defaultValue: "Day-Of" }),
      defaultOpen: true,
      items: [
        { href: "/day-of", label: t("sidebar.day_of_planner", { defaultValue: "Day-Of Planner" }) },
      ],
    },
    {
      id: "planning-tools",
      label: t("sidebar.planning_tools_section", { defaultValue: "Planning Tools" }),
      defaultOpen: false,
      items: [
        { href: "/website-editor", label: t("nav.website_editor", { defaultValue: "Website Editor" }) },
        { href: "/documents", label: t("nav.document_library", { defaultValue: "Document Library" }) },
      ],
    },
    {
      id: "settings",
      label: t("nav.settings", { defaultValue: "Settings" }),
      defaultOpen: false,
      items: [
        { href: "/settings", label: t("nav.settings", { defaultValue: "Settings" }) },
        { href: "/help", label: t("nav.help", { defaultValue: "Help & Support" }) },
        { href: "/help/updates-improvements", label: t("nav.updates_improvements", { defaultValue: "Updates & Improvements" }) },
        ...(isAdmin ? [{ href: "/operations-center", label: t("nav.admin", { defaultValue: "Operations Center" }), special: true }] : []),
      ],
    },
  ];

  const isHrefActive = (href: string) =>
    location === href || (href !== "/dashboard" && location.startsWith(href));

  const toggleSection = (id: string) => {
    setCollapsedSections((current) => ({ ...current, [id]: !current[id] }));
  };

  const NavLink = ({
    href,
    label,
    icon: Icon,
    special = false,
    dot = false,
    sectionLabel = "Workspace",
  }: {
    href: string;
    label: string;
    icon?: React.ElementType;
    special?: boolean;
    dot?: boolean;
    sectionLabel?: string;
  }) => {
    const isActive = isHrefActive(href);
    return (
      <Link
        href={href}
        onPointerEnter={() => prefetchSidebarRoute(href)}
        onFocus={() => prefetchSidebarRoute(href)}
        className={`
          flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-all duration-200 group
          ${
            isActive
              ? special
                ? "bg-primary/15 text-[#24171D] font-bold dark:bg-primary/10 dark:text-[#F7E7D6] dark:ring-1 dark:ring-primary/35"
                : "bg-primary/8 text-primary font-semibold"
              : special
              ? "text-[#24171D] font-bold hover:bg-primary/10 hover:text-[#24171D] dark:text-[#F7E7D6] dark:hover:bg-primary/10 dark:hover:text-[#F7E7D6]"
              : "text-muted-foreground hover:bg-primary/5 hover:text-foreground dark:text-muted-foreground dark:hover:bg-primary/10 dark:hover:text-card-foreground"
          }
        `}
        onClick={() => {
          prefetchSidebarRoute(href);
          void track("tab_bar_feature_used", {
            feature: label,
            tool: label,
            section: sectionLabel,
            path: href,
            fromPath: location,
            source: "sidebar_tab_bar",
          });
          closeMenu();
        }}
        data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {Icon && (
          <Icon
            className={`h-4 w-4 flex-shrink-0 ${
              isActive ? "" : "group-hover:scale-110 transition-transform duration-200"
            }`}
          />
        )}
        <span className="text-sm flex-1">{label}</span>
        {dot && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            online
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {cropSrc && (
        <Suspense fallback={null}>
          <AvatarCropDialog
            imageSrc={cropSrc}
            onConfirm={handleCropConfirm}
            onCancel={() => setCropSrc(null)}
          />
        </Suspense>
      )}
      <input
        ref={picInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handlePicChange}
      />

      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-primary/10 dark:border-primary/20 z-50 flex items-center px-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="btn-toggle-menu"
          className="flex-shrink-0"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
        <div className="flex-1 flex items-center justify-end gap-2">
          <img src="/logo.png" alt="A.I Do Logo" className="h-14 w-auto object-contain" />
          <span className="text-[9px] font-bold tracking-[0.18em] uppercase px-1.5 py-0.5 rounded-full border border-primary/50 text-primary bg-primary/10 dark:bg-primary/10 dark:text-primary dark:border-primary/35">
            BETA
          </span>
        </div>
      </div>

      <div
        ref={sidebarScrollRef}
        onScroll={(e) => {
          sessionStorage.setItem("aido_sidebar_scroll", String((e.target as HTMLDivElement).scrollTop));
        }}
        className={`
          fixed top-0 left-0 h-full w-64 bg-card border-r dark:border-border z-50 transform transition-transform duration-300 ease-in-out pt-16 md:pt-0
          flex flex-col overflow-y-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="hidden md:flex flex-col items-center justify-center px-4 py-3 border-b border-primary/10 gap-1">
          <img src="/logo.png" alt="A.I Do - AI Wedding Planner Assistant" className="h-20 w-auto object-contain" />
          <span className="text-[10px] font-bold tracking-[0.22em] uppercase px-2.5 py-0.5 rounded-full border border-primary/50 text-primary bg-primary/10 dark:bg-primary/10 dark:text-primary dark:border-primary/35">
            BETA
          </span>
        </div>

        <div className="pt-3 pb-1">
          <WorkspaceSwitcher onClose={closeMenu} />
        </div>

        {activeWorkspace && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">
              {activeWorkspace.role === "owner" ? t("sidebar.viewing_client", { defaultValue: "Viewing Client" }) : t("sidebar.viewing_shared")}
            </p>
            <p className="text-xs text-foreground font-medium truncate mt-0.5">
              {activeWorkspace.workstationName || `${activeWorkspace.partner2Name} & ${activeWorkspace.partner1Name}`}
            </p>
          </div>
        )}

        <div className="px-4 pb-3 pt-1 border-b border-primary/10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={uploadingPic}>
              <button
                type="button"
                className="flex items-center gap-3 w-full rounded-xl px-2 py-2 hover:bg-primary/5 transition-colors focus:outline-none disabled:opacity-70"
                title={t("sidebar.profile_picture_title", { defaultValue: "Edit profile picture" })}
              >
                <div className="relative flex-shrink-0">
                  {user?.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt={firstName}
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-primary/20 shadow-sm"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-primary/15 ring-2 ring-primary/20 flex items-center justify-center shadow-sm">
                      <span className="text-primary font-semibold text-base capitalize">{firstName[0]}</span>
                    </div>
                  )}
                  {uploadingPic ? (
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center ring-2 ring-card">
                      <div className="h-2 w-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </span>
                  ) : (
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center ring-2 ring-card">
                      <Pencil className="h-2 w-2 text-white" />
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-sm font-medium text-foreground truncate max-w-[140px]">{firstName}</span>
                  <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">{user?.emailAddresses?.[0]?.emailAddress}</span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => picInputRef.current?.click()}
              >
                {user?.imageUrl
                  ? <><Camera className="h-4 w-4" /> {t("sidebar.replace_photo", { defaultValue: "Replace photo" })}</>
                  : <><ImagePlus className="h-4 w-4" /> {t("sidebar.add_photo", { defaultValue: "Add photo" })}</>
                }
              </DropdownMenuItem>
              {user?.imageUrl && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                    onClick={handleRemovePic}
                  >
                    <Trash2 className="h-4 w-4" /> {t("sidebar.remove_photo", { defaultValue: "Remove photo" })}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav className="flex-1 px-4 py-4">
          <Link
            href="/aria"
            onPointerEnter={() => prefetchSidebarRoute("/aria")}
            onFocus={() => prefetchSidebarRoute("/aria")}
            onClick={() => {
              void track("tab_bar_feature_used", {
                feature: "Ask Aria",
                tool: "Ask Aria",
                section: "Assistant",
                path: "/aria",
                fromPath: location,
                source: "sidebar_ask_button",
              });
              closeMenu();
            }}
            className="mb-5 flex w-full items-center gap-2 rounded-lg border border-[#D4A373]/45 bg-gradient-to-r from-[#F7DDE2] via-[#FFF8F5] to-[#F1D5AF] px-3 py-2.5 text-sm font-semibold text-[#8D3D58] shadow-[0_8px_18px_rgba(141,61,88,0.12)] transition-transform hover:-translate-y-0.5 hover:border-[#D4A373]/70 hover:shadow-[0_10px_24px_rgba(141,61,88,0.18)]"
          >
            <Sparkles className="h-4 w-4 text-[#D4A373]" />
            {t("sidebar.ask_aria", { defaultValue: "Ask Aria" })}
          </Link>

          <div className="space-y-4">
            {!isPlannerOwnWorkspace && sidebarSections.map((section) => {
              const hasActiveItem = section.items.some((item) => isHrefActive(item.href));
              const expanded = section.id in collapsedSections
                ? !collapsedSections[section.id]
                : hasActiveItem || section.defaultOpen;

              return (
                <div key={section.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-primary/5"
                    aria-expanded={expanded}
                  >
                    <span>{section.label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  {expanded && (
                    <div className="space-y-0.5 pl-0">
                      {section.items.map((item) => (
                        <NavLink
                          key={`${section.id}-${item.href}-${item.label}`}
                          href={item.href}
                          label={item.label}
                          special={"special" in item ? item.special : false}
                          sectionLabel={section.label}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="p-3 border-t border-primary/10 space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start gap-3 text-primary hover:text-destructive hover:bg-destructive/5"
          >
            <LogOut className="h-4 w-4" />
            <span>{t("sidebar.sign_out")}</span>
          </Button>
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={closeMenu}
        />
      )}
    </>
  );
}
