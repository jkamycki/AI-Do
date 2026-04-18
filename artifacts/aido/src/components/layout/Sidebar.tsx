import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Heart, 
  Home, 
  User, 
  CalendarDays, 
  Mail, 
  DollarSign, 
  CheckSquare, 
  Smartphone,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/profile", label: "Wedding Profile", icon: User },
  { href: "/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/budget", label: "Budget Manager", icon: DollarSign },
  { href: "/checklist", label: "Checklist", icon: CheckSquare },
  { href: "/vendor-email", label: "Vendor Emails", icon: Mail },
  { href: "/day-of", label: "Day-Of Coordinator", icon: Smartphone },
];

export function Sidebar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

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
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="hidden md:flex items-center gap-2 px-6 py-8 text-primary font-serif font-bold text-2xl border-b">
          <Heart className="h-8 w-8 fill-primary" />
          <span>A.IDO</span>
        </div>
        
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
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
                <Icon className={`h-5 w-5 ${isActive ? '' : 'group-hover:scale-110 transition-transform duration-200'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
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
