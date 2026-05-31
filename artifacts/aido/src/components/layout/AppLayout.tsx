import { Component, lazy, Suspense, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { coupleFirstNames } from "@/lib/coupleNames";
import { Heart } from "lucide-react";

const SupportChat = lazy(() =>
  import("@/components/SupportChat").then((mod) => ({ default: mod.SupportChat })),
);
const VendorReplyNotifier = lazy(() =>
  import("@/components/VendorReplyNotifier").then((mod) => ({ default: mod.VendorReplyNotifier })),
);

class SilentErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

interface AppLayoutProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export function AppLayout({ children, fullWidth = false }: AppLayoutProps) {
  const { activeWorkspace } = useWorkspace();
  const isVendorWorkspace = activeWorkspace?.role === "vendor";
  const workspaceLabel = activeWorkspace
    ? activeWorkspace.workstationName || coupleFirstNames(activeWorkspace.partner2Name, activeWorkspace.partner1Name)
    : "";

  return (
    <div className="portal-shell relative flex min-h-screen overflow-hidden bg-background">
      {!isVendorWorkspace && (
        <SilentErrorBoundary>
          <Sidebar />
        </SilentErrorBoundary>
      )}
      <main className={`relative z-10 flex-1 ${isVendorWorkspace ? "" : "md:ml-64 pt-16 md:pt-0"} overflow-hidden`}>
        {activeWorkspace && !isVendorWorkspace && (
          <div className="border-b border-primary/15 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
            <div className={`${fullWidth ? "px-4 md:px-8" : "max-w-6xl mx-auto px-4 md:px-8"} py-3`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Heart className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                      Viewing Shared Workspace
                    </p>
                    <p className="truncate text-sm font-semibold text-foreground">{workspaceLabel}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {fullWidth ? children : (
          <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        )}
      </main>
      {!isVendorWorkspace && (
        <Suspense fallback={null}>
          <SilentErrorBoundary>
            <SupportChat />
          </SilentErrorBoundary>
          <SilentErrorBoundary>
            <VendorReplyNotifier />
          </SilentErrorBoundary>
        </Suspense>
      )}
    </div>
  );
}
