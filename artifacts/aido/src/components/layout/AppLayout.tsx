import { Sidebar } from "./Sidebar";
import { SupportChat } from "@/components/SupportChat";
import { VendorReplyNotifier } from "@/components/VendorReplyNotifier";
import { NextStepNudge } from "@/components/NextSteps/NextStepNudge";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 md:ml-64 pt-16 md:pt-0">
        <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
      <SupportChat />
      <VendorReplyNotifier />
      <NextStepNudge />
    </div>
  );
}
