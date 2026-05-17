import { Component, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { SupportChat } from "@/components/SupportChat";
import { VendorReplyNotifier } from "@/components/VendorReplyNotifier";
import { useWorkspace } from "@/contexts/WorkspaceContext";

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

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[url('/images/floral-bg.png')] bg-cover bg-center opacity-[0.14] mix-blend-multiply dark:opacity-[0.18] dark:mix-blend-luminosity" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_48%_0%,rgba(255,255,255,0.72)_0%,rgba(255,247,242,0.42)_34%,rgba(242,226,198,0.22)_100%)] dark:bg-[radial-gradient(circle_at_48%_0%,rgba(247,231,214,0.1)_0%,rgba(38,42,50,0.36)_40%,rgba(15,17,21,0.68)_100%)]" />
      {!isVendorWorkspace && (
        <SilentErrorBoundary>
          <Sidebar />
        </SilentErrorBoundary>
      )}
      <main className={`relative z-10 flex-1 ${isVendorWorkspace ? "" : "md:ml-64 pt-16 md:pt-0"} overflow-hidden`}>
        {fullWidth ? children : (
          <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        )}
      </main>
      {!isVendorWorkspace && (
        <>
          <SilentErrorBoundary>
            <SupportChat />
          </SilentErrorBoundary>
          <SilentErrorBoundary>
            <VendorReplyNotifier />
          </SilentErrorBoundary>
        </>
      )}
    </div>
  );
}
