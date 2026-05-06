import { useState, lazy, Suspense, Component } from "react";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useRoute, Link } from "wouter";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useGetProfile } from "@workspace/api-client-react";
import { Sparkles } from "lucide-react";

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

function isStaleChunkError(message: string): boolean {
  return /Failed to fetch dynamically imported module|Loading chunk \d+ failed|Importing a module script failed|ChunkLoadError/i.test(message);
}

function refreshShortcutHint(): string {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
  return isMac ? "Cmd + Shift + R" : "Ctrl + Shift + R";
}

class TabErrorBoundary extends Component<{ children: ReactNode; tabName: string }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`Tab "${this.props.tabName}" failed to load:`, error);
    // Auto-reload once on stale-chunk errors so users don't see this screen
    // after a deploy (the page has the new index.html but is asking for old
    // chunk files that no longer exist on the server). Guard with sessionStorage
    // so we don't loop if the reload doesn't fix it.
    if (isStaleChunkError(error.message)) {
      const flag = "aido_chunk_reload_attempted";
      if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(flag)) {
        sessionStorage.setItem(flag, String(Date.now()));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || "Unknown error";
      const stack = this.state.error?.stack || "";
      const isStale = isStaleChunkError(message);
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 space-y-3">
          <div className="text-center space-y-2">
            <p className="font-semibold text-destructive">
              {isStale ? "This page needs to be refreshed" : "This tab failed to load"}
            </p>
            {isStale ? (
              <>
                <p className="text-sm text-muted-foreground">
                  We just shipped an update and your browser still has the old version cached. A quick refresh will load the new files.
                </p>
                <div className="flex flex-col items-center gap-2 pt-2">
                  <Button onClick={() => window.location.reload()} className="gap-2">
                    <Sparkles className="h-4 w-4" /> Refresh now
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Or press <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[11px]">{refreshShortcutHint()}</kbd> for a hard refresh.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Try a hard refresh — press <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[11px]">{refreshShortcutHint()}</kbd> — to reload the page. If the issue persists, share the details below with support.
              </p>
            )}
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
  const { data: profile, isLoading: profileLoading } = useGetProfile();

  const profileId = params?.profileId
    ? parseInt(params.profileId)
    : activeWorkspace?.profileId || profile?.id;

  const [activeTab, setActiveTab] = useState("guest-list");

  if (!profileId) {
    if (profileLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4 max-w-md mx-auto px-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-serif font-semibold">Complete Your Wedding Profile</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            You need to set up your wedding profile before you can manage guests and invitations.
          </p>
        </div>
        <Link href="/profile">
          <Button>Set Up Wedding Profile</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold">
          Guest List & Invitations
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40 align-middle">
            v2
          </span>
        </h1>
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
