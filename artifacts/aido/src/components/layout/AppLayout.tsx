import { Component, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { SupportChat } from "@/components/SupportChat";
import { VendorReplyNotifier } from "@/components/VendorReplyNotifier";
import { NextStepNudge } from "@/components/NextSteps/NextStepNudge";

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
  return (
    <div className="min-h-screen bg-background flex">
      <SilentErrorBoundary>
        <Sidebar />
      </SilentErrorBoundary>
      <main className="flex-1 md:ml-64 pt-16 md:pt-0 overflow-hidden">
        {fullWidth ? children : (
          <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        )}
      </main>
      <SilentErrorBoundary>
        <SupportChat />
      </SilentErrorBoundary>
      <SilentErrorBoundary>
        <VendorReplyNotifier />
      </SilentErrorBoundary>
      <SilentErrorBoundary>
        <NextStepNudge />
      </SilentErrorBoundary>
    </div>
  );
}
