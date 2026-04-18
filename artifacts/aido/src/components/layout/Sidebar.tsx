import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser, useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
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
  { href: "/day-of", label: "Day-Of Coordinator", icon: Smartphone },
];

export function Sidebar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const { getToken, isSignedIn } = useAuth();

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

  const NavLink = ({ href, label, icon: Icon, special = false }: {
    href: string;
    label: string;
    icon: React.ElementType;
    special?: boolean;
  }) => {
    const isActive = location === href || (href !== "/dashboard" && location.startsWith(href));
    return (
      <Link
        href={href}
        className={`
          flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
          ${isActive
            ? special
              ? "bg-primary/15 text-primary font-medium"
              : "bg-primary text-primary-foreground font-medium shadow-md"
            : special
              ? "hover:bg-primary/10 text-primary/70 hover:text-primary"
              : "hover:bg-primary/10 text-card-foreground hover:text-primary"
          }
        `}
        onClick={() => setIsOpen(false)}
        data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "" : "group-hover:scale-110 transition-transform duration-200"}`} />
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
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)} data-testid="btn-toggle-menu">
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      <div className={`
        fixed top-0 left-0 h-full w-64 bg-card border-r z-40 transform transition-transform duration-300 ease-in-out pt-16 md:pt-0
        flex flex-col
        ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="hidden md:flex items-center gap-2 px-6 py-8 text-primary font-serif font-bold text-2xl border-b border-primary/10">
          <Heart className="h-8 w-8 fill-primary" />
          <span>A.IDO</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
          ))}

          {isAdmin && (
            <div className="pt-3 mt-3 border-t border-primary/10">
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Admin
              </p>
              <NavLink
                href="/admin"
                label="Operations Center"
                icon={Shield}
                special
              />
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-primary/10">
          {user && (
            <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                {user.imageUrl ? (
                  <img src={user.imageUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <span className="text-primary text-sm font-semibold">
                    {(user.firstName?.[0] ?? user.emailAddresses[0]?.emailAddress?.[0] ?? "U").toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground truncate">
                  {user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.emailAddresses[0]?.emailAddress ?? ""}
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
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
