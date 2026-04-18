import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
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

  const handleSignOut = () => {
    signOut({ redirectUrl: "/" });
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
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="hidden md:flex items-center gap-2 px-6 py-8 text-primary font-serif font-bold text-2xl border-b border-primary/10">
          <Heart className="h-8 w-8 fill-primary" />
          <span>A.IDO</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
                  ${isActive 
                    ? 'bg-primary text-primary-foreground font-medium shadow-md' 
                    : 'hover:bg-primary/10 text-card-foreground hover:text-primary'}
                `}
                onClick={() => setIsOpen(false)}
                data-testid={`nav-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? '' : 'group-hover:scale-110 transition-transform duration-200'}`} />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
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
