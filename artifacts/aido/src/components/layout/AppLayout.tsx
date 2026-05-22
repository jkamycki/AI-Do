import { Component, lazy, Suspense, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useWorkspace } from "@/contexts/WorkspaceContext";
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
    ? activeWorkspace.workstationName || `${activeWorkspace.partner2Name} & ${activeWorkspace.partner1Name}`
    : "";

  return (
    <div className="portal-shell relative flex min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[url('/images/floral-bg.png')] bg-cover bg-center opacity-[0.07] mix-blend-multiply dark:opacity-[0.18] dark:mix-blend-luminosity" />
      <div
        className="pointer-events-none fixed inset-0 z-0 dark:bg-[radial-gradient(circle_at_48%_0%,rgba(247,231,214,0.1)_0%,rgba(38,42,50,0.36)_40%,rgba(15,17,21,0.68)_100%)]"
        style={{
          background:
            "radial-gradient(circle at 18% 4%, rgba(141, 41, 77, 0.1) 0%, rgba(177, 108, 142, 0.07) 26%, transparent 54%), radial-gradient(circle at 76% 0%, rgba(230, 166, 183, 0.12) 0%, rgba(255, 247, 242, 0.62) 34%, rgba(255, 250, 246, 0.52) 100%)",
        }}
      />
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
