import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser, useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace, type WorkspaceInfo } from "@/contexts/WorkspaceContext";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Wedding Profile", icon: User },
  { href: "/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/budget", label: "Budget Manager", icon: DollarSign },
  { href: "/checklist", label: "Checklist", icon: CheckSquare },
  { href: "/vendors", label: "Vendors", icon: Store },
  { href: "/vendor-email", label: "Vendor Emails", icon: Mail },
  { href: "/guests", label: "Guest List", icon: UsersRound },
  { href: "/seating-chart", label: "Seating Chart", icon: Armchair },
  { href: "/day-of", label: "Day-Of Coordinator", icon: Smartphone },
];

interface WorkspacesData {
  ownProfile: {
    profileId: number;
    partner1Name: string;
    partner2Name: string;
    weddingDate: string;
  } | null;
  sharedWorkspaces: Array<{
    id: number;
    profileId: number;
    role: string;
    status: string;
    partner1Name: string;
    partner2Name: string;
    weddingDate: string;
  }>;
}

function WorkspaceSwitcher({ onClose }: { onClose: () => void }) {
  const { getToken, isSignedIn } = useAuth();
  const { activeWorkspace, setActiveWorkspace } = useWorkspace();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);

  const { data } = useQuery<WorkspacesData>({
    queryKey: ["my-workspaces"],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch("/api/collaborators/my-workspaces", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) return { ownProfile: null, sharedWorkspaces: [] };
      return r.json();
    },
    enabled: !!isSignedIn,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const sharedWorkspaces = data?.sharedWorkspaces ?? [];
  if (sharedWorkspaces.length === 0) return null;

  const currentLabel = activeWorkspace
    ? `${activeWorkspace.partner1Name} & ${activeWorkspace.partner2Name}`
    : "My Workspace";

  const handleSelectOwn = () => {
    setActiveWorkspace(null);
    setOpen(false);
    setLocation("/dashboard");
    onClose();
  };

  const handleSelectShared = (ws: WorkspacesData["sharedWorkspaces"][0]) => {
    const info: WorkspaceInfo = {
      profileId: ws.profileId,
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
          <p className="px-3 py-1 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Workspaces</p>
          <button
            onClick={handleSelectOwn}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left
              ${!activeWorkspace ? "text-primary font-medium" : "text-foreground"}`}
          >
            <Heart className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="truncate">My Workspace</span>
            {!activeWorkspace && <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Active</span>}
          </button>
          {sharedWorkspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => handleSelectShared(ws)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left
                ${activeWorkspace?.profileId === ws.profileId ? "text-primary font-medium" : "text-foreground"}`}
            >
              <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{ws.partner1Name} & {ws.partner2Name}</div>
                <div className="text-[10px] text-muted-foreground capitalize">{ws.role}</div>
              </div>
              {activeWorkspace?.profileId === ws.profileId && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0">Active</span>
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
  const { getToken, isSignedIn } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const { data: adminCheck } = useQuery({
    queryKey: ["admin-check"],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch("/api/admin/check", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) return { isAdmin: false };
      return r.json() as Promise<{ isAdmin: boolean }>;
    },
    enabled: !!isSignedIn,
    staleTime: 0,
    retry: false,
  });

  const isAdmin = adminCheck?.isAdmin === true;

  const handleSignOut = () => {
    signOut({ redirectUrl: "/" });
  };

  const closeMenu = () => setIsOpen(false);

  const NavLink = ({
    href,
    label,
    icon: Icon,
    special = false,
  }: {
    href: string;
    label: string;
    icon: React.ElementType;
    special?: boolean;
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
                ? "bg-primary/15 text-primary font-medium"
                : "bg-primary text-primary-foreground font-medium shadow-md"
              : special
              ? "hover:bg-primary/10 text-primary/70 hover:text-primary"
              : "hover:bg-primary/10 text-card-foreground hover:text-primary"
          }
        `}
        onClick={closeMenu}
        data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <Icon
          className={`h-5 w-5 flex-shrink-0 ${
            isActive ? "" : "group-hover:scale-110 transition-transform duration-200"
          }`}
        />
        <span className="text-sm">{label}</span>
      </Link>
    );
  };

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background border-b z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-primary font-serif font-bold text-xl">
          <Heart className="h-6 w-6 fill-primary" />
          <span>A.IDO</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="btn-toggle-menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      <div
        className={`
          fixed top-0 left-0 h-full w-64 bg-card border-r z-40 transform transition-transform duration-300 ease-in-out pt-16 md:pt-0
          flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="hidden md:flex items-center gap-2 px-6 py-6 text-primary font-serif font-bold text-2xl border-b border-primary/10">
          <Heart className="h-8 w-8 fill-primary" />
          <span>A.IDO</span>
        </div>

        <div className="pt-3 pb-1">
          <WorkspaceSwitcher onClose={closeMenu} />
        </div>

        {activeWorkspace && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Viewing shared workspace</p>
            <p className="text-xs text-amber-800 font-medium truncate mt-0.5">
              {activeWorkspace.partner1Name} & {activeWorkspace.partner2Name}
            </p>
          </div>
        )}

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
          ))}

          <div className="pt-3 mt-3 border-t border-primary/10 space-y-1">
            <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Workspace
            </p>
            <NavLink href="/settings" label="Settings & Collaborators" icon={Settings} />
            <NavLink href="/help" label="Help & Support" icon={HelpCircle} />
          </div>

          {isAdmin && (
            <div className="pt-3 mt-3 border-t border-primary/10 space-y-1">
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Admin
              </p>
              <NavLink href="/admin" label="Operations Center" icon={Shield} special />
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-primary/10">
          {user && (
            <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                {user.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt="avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-primary text-sm font-semibold">
                    {(
                      user.firstName?.[0] ??
                      user.emailAddresses[0]?.emailAddress?.[0] ??
                      "U"
                    ).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground truncate">
                  {user.firstName
                    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
                    : (user.emailAddresses[0]?.emailAddress ?? "")}
                </p>
                {user.firstName && (
                  <p className="text-xs text-muted-foreground truncate">
                    {user.emailAddresses[0]?.emailAddress ?? ""}
                  </p>
                )}
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
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
