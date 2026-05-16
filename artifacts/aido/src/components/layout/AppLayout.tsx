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
    <div className="min-h-screen bg-background flex">
      {!isVendorWorkspace && (
        <SilentErrorBoundary>
          <Sidebar />
        </SilentErrorBoundary>
      )}
      <main className={`flex-1 ${isVendorWorkspace ? "" : "md:ml-64 pt-16 md:pt-0"} overflow-hidden`}>
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
