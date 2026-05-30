import { useState, lazy, Suspense, Component } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoute, Link } from "wouter";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useGetProfile } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { Armchair, BedDouble, Camera, Send, Sparkles, Users } from "lucide-react";

const Guests = lazy(() => import("./Guests"));
const InvitationCustomization = lazy(() => import("./InvitationCustomization"));
type InvitationDefaultTab = "saveTheDate" | "digitalInvitation";

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
      if (isStale) {
        return <div className="min-h-[240px] bg-background" aria-hidden="true" />;
      }
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 space-y-3">
          <div className="text-center space-y-2">
            <p className="font-semibold text-destructive">
              This tab failed to load
            </p>
            <p className="text-sm text-muted-foreground">
              Try a hard refresh - press <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[11px]">{refreshShortcutHint()}</kbd> - to reload the page. If the issue persists, share the details below with support.
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
  const { data: profile, isLoading: profileLoading } = useGetProfile();
  const { t } = useTranslation();

  const profileId = params?.profileId
    ? parseInt(params.profileId)
    : activeWorkspace?.profileId || profile?.id;

  const [activeTab, setActiveTab] = useState("guest-list");
  const [guestListDefaultInvitation, setGuestListDefaultInvitation] =
    useState<InvitationDefaultTab>("saveTheDate");

  const mobileGuestHubActions = [
    {
      label: "Guest List",
      description: "Manage names, RSVP status, meals, and plus-ones.",
      icon: Users,
      isActive: activeTab === "guest-list",
      onClick: () => setActiveTab("guest-list"),
    },
    {
      label: "Invitation Studio",
      description: "Send Save the Dates, RSVP invites, and reminders.",
      icon: Send,
      isActive: activeTab === "invitation-customization",
      onClick: () => setActiveTab("invitation-customization"),
    },
    {
      label: "Photo Drop",
      description: "Share the guest photo QR code and review uploads.",
      icon: Camera,
      href: "/guest-photo-drop",
    },
    {
      label: "Seating",
      description: "Use AI seating and simple guest moves on the go.",
      icon: Armchair,
      href: "/seating-chart",
    },
    {
      label: "Hotels",
      description: "Track travel notes, room blocks, and guest stays.",
      icon: BedDouble,
      href: "/hotels",
    },
  ];

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
          <h2 className="text-2xl font-serif font-semibold">{t("guests.complete_profile_title", { defaultValue: "Complete Your Wedding Profile" })}</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {t("guests.complete_profile_desc", { defaultValue: "You need to set up your wedding profile before you can manage guests and invitations." })}
          </p>
        </div>
        <Link href="/profile">
          <Button>{t("guests.set_up_profile", { defaultValue: "Set Up Wedding Profile" })}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold sm:text-3xl">
          {t("guests.page_title", { defaultValue: "Guest List & Invitations" })}
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40 align-middle">
            v2
          </span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1 sm:text-base">
          {t("guests.page_subtitle", { defaultValue: "Manage guests, design digital invitations, and prepare print-ready invitation suites." })}
        </p>
      </div>

      <div className="md:hidden rounded-2xl border border-primary/15 bg-[#FFF8F1]/90 p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/80">
              Guest Hub
            </p>
            <h2 className="font-serif text-xl font-semibold text-[#3B1C2B]">
              Plan guest moments
            </h2>
          </div>
          <span className="rounded-full border border-primary/15 bg-white/75 px-3 py-1 text-xs font-semibold text-primary">
            Mobile
          </span>
        </div>
        <div className="grid gap-2">
          {mobileGuestHubActions.map((action) => {
            const Icon = action.icon;
            const content = (
              <span
                className={`flex min-h-[76px] w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  action.isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-primary/15 bg-white/75 text-[#3B1C2B] hover:bg-primary/10"
                }`}
              >
                <span
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    action.isActive ? "bg-white/20" : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{action.label}</span>
                  <span
                    className={`mt-0.5 block text-xs leading-snug ${
                      action.isActive ? "text-primary-foreground/85" : "text-muted-foreground"
                    }`}
                  >
                    {action.description}
                  </span>
                </span>
              </span>
            );

            if ("href" in action && action.href) {
              return (
                <Link key={action.label} href={action.href}>
                  {content}
                </Link>
              );
            }

            return (
              <button key={action.label} type="button" onClick={action.onClick}>
                {content}
              </button>
            );
          })}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/70 p-1">
          <TabsTrigger value="guest-list" className="min-h-10 whitespace-normal px-2 text-center text-xs font-bold leading-tight sm:text-sm">{t("guests.tab_guest_list", { defaultValue: "Guest List" })}</TabsTrigger>
          <TabsTrigger value="invitation-customization" className="min-h-10 whitespace-normal px-2 text-center text-xs font-bold leading-tight sm:text-sm">{t("guests.tab_invitation", { defaultValue: "Invitation Studio" })}</TabsTrigger>
        </TabsList>

        <TabsContent value="guest-list" className="mt-6">
          <TabErrorBoundary tabName="Guest List">
            <Suspense fallback={<TabSkeleton />}>
              <Guests sendDefaultInvitation={guestListDefaultInvitation} />
            </Suspense>
          </TabErrorBoundary>
        </TabsContent>

        <TabsContent value="invitation-customization" forceMount className="mt-6 data-[state=inactive]:hidden">
          <TabErrorBoundary tabName="Invitation Studio">
            <Suspense fallback={<TabSkeleton />}>
              <InvitationCustomization
                profileId={profileId}
                onOpenGuestList={(defaultInvitation) => {
                  setGuestListDefaultInvitation(defaultInvitation ?? "saveTheDate");
                  setActiveTab("guest-list");
                }}
              />
            </Suspense>
          </TabErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
