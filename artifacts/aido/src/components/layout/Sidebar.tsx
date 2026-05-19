import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser, useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace, type WorkspaceInfo } from "@/contexts/WorkspaceContext";
import { useTranslation } from "react-i18next";
import {
  Heart,
  LayoutDashboard,
  User,
  CalendarDays,
  Mail,
  DollarSign,
  CheckSquare,
  Smartphone,
  Store,
  Menu,
  X,
  LogOut,
  Shield,
  Settings,
  ChevronDown,
  Users,
  Crown,
  HelpCircle,
  Armchair,
  UsersRound,
  Hotel,
  Flower2,
  FolderOpen,
  Sparkles,
  Camera,
  ImagePlus,
  Trash2,
  Pencil,
  Globe,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { AvatarCropDialog } from "@/components/AvatarCropDialog";
import { authFetch } from "@/lib/authFetch";
import { useTheme } from "@/contexts/ThemeContext";
import { useTracking } from "@/hooks/useTracking";

const navSections = [
  {
    labelKey: "nav.planning",
    items: [
      { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
      { href: "/profile", labelKey: "nav.profile", icon: User },
      { href: "/mood-board", labelKey: "nav.mood_board", icon: ImagePlus },
      { href: "/timeline", labelKey: "nav.timeline", icon: CalendarDays },
      { href: "/checklist", labelKey: "nav.checklist", icon: CheckSquare },
    ],
  },
  {
    labelKey: "nav.budget_vendors",
    items: [
      { href: "/vendors", labelKey: "nav.vendors", icon: Store },
      { href: "/budget", labelKey: "nav.budget", icon: DollarSign },
      { href: "/documents", labelKey: "nav.document_library", icon: FolderOpen },
    ],
  },
  {
    labelKey: "nav.guests_label",
    items: [
      { href: "/guests", labelKey: "nav.guests", icon: UsersRound },
      { href: "/wedding-party", labelKey: "nav.party", icon: Crown },
      { href: "/seating-chart", labelKey: "nav.seating", icon: Armchair },
      { href: "/hotels", labelKey: "nav.hotels", icon: Hotel },
    ],
  },
  {
    labelKey: "nav.ai_label",
    items: [
      { href: "/aria", labelKey: "nav.aria", icon: Sparkles },
      { href: "/day-of", labelKey: "nav.dayof", icon: Smartphone },
    ],
  },
];

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
            <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Shared with me</p>
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
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { track } = useTracking();
  const picInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const isPlannerOwnWorkspace = false;

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
    signOut({ redirectUrl: "/" });
  };

  const closeMenu = () => setIsOpen(false);

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
    icon: React.ElementType;
    special?: boolean;
    dot?: boolean;
    sectionLabel?: string;
  }) => {
    const isActive =
      location === href || (href !== "/dashboard" && location.startsWith(href));
    return (
      <Link
        href={href}
        className={`
          flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
          ${
            isActive
              ? special
                ? "bg-primary/15 text-[#24171D] font-bold dark:bg-primary/10 dark:text-[#F7E7D6] dark:ring-1 dark:ring-primary/35"
                : "bg-primary text-primary-foreground font-medium shadow-md dark:bg-primary/15 dark:text-primary dark:ring-1 dark:ring-primary/35 dark:shadow-none"
              : special
              ? "text-[#24171D] font-bold hover:bg-primary/10 hover:text-[#24171D] dark:text-[#F7E7D6] dark:hover:bg-primary/10 dark:hover:text-[#F7E7D6]"
              : "hover:bg-primary/10 text-card-foreground hover:text-primary dark:text-card-foreground dark:hover:bg-primary/10 dark:hover:text-primary"
          }
        `}
        onClick={() => {
          void track("tab_bar_feature_used", {
            feature: label,
            tool: label,
            section: sectionLabel,
            path: href,
            fromPath: location,
            source: "sidebar_tab_bar",
          });
          void track("feature_accessed", {
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
        <Icon
          className={`h-5 w-5 flex-shrink-0 ${
            isActive ? "" : "group-hover:scale-110 transition-transform duration-200"
          }`}
        />
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
        <AvatarCropDialog
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
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
        <div className="hidden md:flex flex-col items-center justify-center px-4 py-4 border-b border-primary/10 gap-2">
          <img src="/logo.png" alt="A.I Do — AI Wedding Planner Assistant" className="h-44 w-auto object-contain" />
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
              {activeWorkspace.role === "owner" ? "Viewing Client" : t("sidebar.viewing_shared")}
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
                title="Edit profile picture"
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
        </div>

        <nav className="flex-1 p-4 space-y-4">
          {!isPlannerOwnWorkspace && (
            <>
              {navSections.map((section) => (
                <div key={section.labelKey}>
                  <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-primary dark:text-primary/80">
                    {t(section.labelKey, { defaultValue: section.labelKey })}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.href}
                        href={item.href}
                        label={t(item.labelKey)}
                        icon={item.icon}
                        dot={"dot" in item ? item.dot as boolean : undefined}
                        sectionLabel={t(section.labelKey, { defaultValue: section.labelKey })}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <div className="border-t border-primary/10 pt-4">
                <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-primary dark:text-primary/80">
                  {t("sidebar.guest_website_builder", { defaultValue: "Guest Website Builder" })}
                </p>
                <div className="space-y-0.5">
                  <NavLink
                    href="/website-editor"
                    label={t("nav.website_editor", { defaultValue: "Website Editor" })}
                    icon={Globe}
                    sectionLabel={t("sidebar.guest_website_builder", { defaultValue: "Guest Website Builder" })}
                  />
                </div>
              </div>
            </>
          )}

          <div className="border-t border-primary/10 pt-4">
            <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-primary dark:text-primary/80">
              {t("sidebar.workspace_section")}
            </p>
            <div className="space-y-0.5">
              <NavLink href="/settings" label={t("nav.settings")} icon={Settings} sectionLabel={t("sidebar.workspace_section")} />
              <NavLink href="/help" label={t("nav.help")} icon={HelpCircle} sectionLabel={t("sidebar.workspace_section")} />
              <NavLink
                href="/help/updates-improvements"
                label={t("nav.updates_improvements", { defaultValue: "Updates & Improvements" })}
                icon={Sparkles}
                sectionLabel={t("sidebar.workspace_section")}
              />
            </div>
          </div>

          {isAdmin && (
            <div className="border-t border-primary/10 pt-4">
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t("sidebar.admin_section")}
              </p>
              <div className="space-y-0.5">
                <NavLink href="/operations-center" label={t("nav.admin")} icon={Shield} special sectionLabel={t("sidebar.admin_section")} />
              </div>
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-primary/10 space-y-2">
          <div className="rounded-md border border-primary/15 bg-card/75 px-2.5 py-2 shadow-sm dark:border-primary/20 dark:bg-secondary/45 dark:shadow-none">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary dark:text-primary">Theme</p>
                <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                  {theme === "dark" ? "Dark mode" : "Light palette mode"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Sun className={`h-3.5 w-3.5 ${theme === "light" ? "text-primary" : "text-muted-foreground"}`} />
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  aria-label="Toggle dark mode"
                  className="h-4 w-8"
                />
                <Moon className={`h-3.5 w-3.5 ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`} />
              </div>
            </div>
          </div>
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
