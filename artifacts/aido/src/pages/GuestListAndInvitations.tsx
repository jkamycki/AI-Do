import { useState, lazy, Suspense, Component } from "react";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoute } from "wouter";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useGetProfile } from "@workspace/api-client-react";

const Guests = lazy(() => import("./Guests"));
const InvitationCustomization = lazy(() => import("./InvitationCustomization"));
const WeddingParty = lazy(() => import("./WeddingParty"));

function TabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
      </div>
    </div>
  );
}

class TabErrorBoundary extends Component<{ children: ReactNode; tabName: string }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`Tab "${this.props.tabName}" failed to load:`, error);
  }

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || "Unknown error";
      const stack = this.state.error?.stack || "";
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 space-y-3">
          <div className="text-center">
            <p className="font-semibold text-destructive">This tab failed to load</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try refreshing the page. If it persists, share the details below with support.
            </p>
          </div>
          <details className="text-xs bg-background/50 rounded p-3 border border-border/40">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Show technical details
            </summary>
            <p className="mt-2 font-mono text-destructive break-words">{message}</p>
            {stack && (
              <pre className="mt-2 whitespace-pre-wrap break-words text-muted-foreground text-[10px] max-h-40 overflow-auto">
                {stack}
              </pre>
            )}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

interface RouteParams {
  profileId?: string;
}

export default function GuestListAndInvitations() {
  const [, params] = useRoute("/guests/:profileId");
  const { activeWorkspace } = useWorkspace();
  const { data: profile } = useGetProfile();

  const profileId = params?.profileId
    ? parseInt(params.profileId)
    : activeWorkspace?.profileId || profile?.id;

  const [activeTab, setActiveTab] = useState("guest-list");

  if (!profileId) {
    return <div className="p-4 text-center">Loading profile...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold">Guest List & Invitations</h1>
        <p className="text-muted-foreground mt-1">
          Manage your guests and customize your invitation designs
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="guest-list">Guest List</TabsTrigger>
          <TabsTrigger value="invitation-customization">Invitation Customization</TabsTrigger>
          <TabsTrigger value="wedding-party">Wedding Party</TabsTrigger>
        </TabsList>

        <TabsContent value="guest-list" className="mt-6">
          <TabErrorBoundary tabName="Guest List">
            <Suspense fallback={<TabSkeleton />}>
              <Guests />
            </Suspense>
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="invitation-customization" className="mt-6">
          <TabErrorBoundary tabName="Invitation Customization">
            <Suspense fallback={<TabSkeleton />}>
              <InvitationCustomization profileId={profileId} />
            </Suspense>
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="wedding-party" className="mt-6">
          <TabErrorBoundary tabName="Wedding Party">
            <Suspense fallback={<TabSkeleton />}>
              <WeddingParty />
            </Suspense>
          </TabErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
