import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth, SignIn, SignUp } from "@clerk/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, CheckCircle2, XCircle, Crown, Briefcase, Eye, AlertCircle } from "lucide-react";

type CollabRole = "partner" | "planner" | "vendor";

const ROLE_CONFIG: Record<CollabRole, { label: string; description: string; icon: React.ElementType; color: string }> = {
  partner: {
    label: "Partner",
    description: "Full access to all planning tools — timeline, budget, checklist, vendors, and emails.",
    icon: Crown,
    color: "text-purple-600",
  },
  planner: {
    label: "Planner",
    description: "Edit and manage the timeline, checklist, vendor emails, and budget.",
    icon: Briefcase,
    color: "text-blue-600",
  },
  vendor: {
    label: "Vendor",
    description: "View the day-of timeline and download PDF documents shared with you.",
    icon: Eye,
    color: "text-amber-600",
  },
};

export default function InviteAcceptPage() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token ?? "";
  const [, setLocation] = useLocation();
  const { isSignedIn, getToken } = useAuth();
  const { setActiveWorkspace } = useWorkspace();
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignUp, setShowSignUp] = useState(false);

  // The current invite URL — after sign-in/up Clerk will redirect back here
  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/invite/${token}`
    : `/invite/${token}`;

  const authedFetch = async (url: string, init: RequestInit = {}) => {
    const t = await getToken();
    return fetch(url, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
    });
  };

  const { data: invite, isLoading, isError } = useQuery({
    queryKey: ["invite", token],
    queryFn: async () => {
      const r = await fetch(`/api/invite/${token}`);
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Invite not found");
      }
      return r.json() as Promise<{
        id: number;
        role: CollabRole;
        status: string;
        inviteeEmail: string;
        partner1Name: string;
        partner2Name: string;
        weddingDate: string;
        venue: string;
        profileId: number;
      }>;
    },
    enabled: !!token,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const r = await authedFetch(`/api/invite/${token}/accept`, { method: "POST" });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Failed to accept");
      }
      return r.json() as Promise<{
        profileId: number;
        role: string;
        partner1Name: string;
        partner2Name: string;
        weddingDate: string;
      }>;
    },
    onSuccess: (data) => {
      setActiveWorkspace({
        profileId: data.profileId,
        role: data.role,
        partner1Name: data.partner1Name,
        partner2Name: data.partner2Name,
        weddingDate: data.weddingDate,
      });
      setAccepted(true);
      setTimeout(() => setLocation(`/workspace/${data.profileId}`), 2000);
    },
    onError: (err: Error) => setError(err.message),
  });

  // If signed in and invite is already accepted, restore workspace context and redirect
  useEffect(() => {
    if (isSignedIn && invite && invite.status === "accepted" && !accepted) {
      setActiveWorkspace({
        profileId: invite.profileId,
        role: invite.role,
        partner1Name: invite.partner1Name,
        partner2Name: invite.partner2Name,
        weddingDate: invite.weddingDate,
      });
      setLocation(`/workspace/${invite.profileId}`);
    }
  }, [isSignedIn, invite, accepted]);

  const declineMutation = useMutation({
    mutationFn: async () => {
      const r = await authedFetch(`/api/invite/${token}/decline`, { method: "POST" });
      if (!r.ok) throw new Error("Failed to decline");
    },
    onSuccess: () => setDeclined(true),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-10 w-48 mx-auto" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !invite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-serif text-foreground">Invite Not Found</h1>
          <p className="text-muted-foreground">This invite link is invalid, has expired, or has already been used.</p>
          <Button variant="outline" onClick={() => setLocation("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  if (accepted) {
    const RoleIcon = ROLE_CONFIG[invite.role]?.icon ?? Eye;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-serif text-foreground">You're in!</h1>
          <p className="text-muted-foreground">
            You've joined <strong>{invite.partner1Name} & {invite.partner2Name}'s</strong> wedding workspace as a <strong>{ROLE_CONFIG[invite.role]?.label}</strong>. Redirecting to your dashboard…
          </p>
        </div>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
            <XCircle className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-serif text-foreground">Invitation Declined</h1>
          <p className="text-muted-foreground">You've declined the invitation. You can close this page.</p>
          <Button variant="outline" onClick={() => setLocation("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const RoleCfg = ROLE_CONFIG[invite.role];
  const RoleIcon = RoleCfg?.icon ?? Eye;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-primary font-serif font-bold text-2xl mb-4">
            <Heart className="h-7 w-7 fill-primary" />
            A.IDO
          </div>
          <h1 className="text-3xl font-serif text-foreground">You're Invited!</h1>
          <p className="text-muted-foreground">You've been invited to collaborate on a wedding workspace.</p>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-6 space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-serif text-primary">
              {invite.partner1Name} & {invite.partner2Name}
            </h2>
            <p className="text-muted-foreground text-sm">
              {invite.weddingDate} · {invite.venue}
            </p>
          </div>

          <div className={`flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/15`}>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <RoleIcon className={`h-5 w-5 ${RoleCfg?.color ?? "text-primary"}`} />
            </div>
            <div>
              <p className="font-semibold text-foreground">Role: {RoleCfg?.label ?? invite.role}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{RoleCfg?.description}</p>
            </div>
          </div>

          {invite.status !== "pending" && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 text-center">
              This invitation has already been {invite.status}.
            </div>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive text-center">
              {error}
            </div>
          )}

          {!isSignedIn ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Sign in or create an account to accept this invitation.
              </p>
              {showSignUp ? (
                <>
                  <SignUp
                    forceRedirectUrl={inviteUrl}
                    signInUrl={`/sign-in`}
                    appearance={{ elements: { rootBox: "w-full", card: "shadow-none border-0 p-0" } }}
                  />
                  <p className="text-xs text-center text-muted-foreground">
                    Already have an account?{" "}
                    <button className="text-primary underline" onClick={() => setShowSignUp(false)}>Sign in</button>
                  </p>
                </>
              ) : (
                <>
                  <SignIn
                    forceRedirectUrl={inviteUrl}
                    signUpUrl={`/sign-up`}
                    appearance={{ elements: { rootBox: "w-full", card: "shadow-none border-0 p-0" } }}
                  />
                  <p className="text-xs text-center text-muted-foreground">
                    Don't have an account?{" "}
                    <button className="text-primary underline" onClick={() => setShowSignUp(true)}>Create one</button>
                  </p>
                </>
              )}
            </div>
          ) : invite.status === "pending" ? (
            <div className="flex gap-3">
              <Button
                className="flex-1 gap-2"
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending || declineMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                {acceptMutation.isPending ? "Accepting…" : "Accept Invitation"}
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2 text-muted-foreground"
                onClick={() => declineMutation.mutate()}
                disabled={acceptMutation.isPending || declineMutation.isPending}
              >
                <XCircle className="h-4 w-4" />
                {declineMutation.isPending ? "Declining…" : "Decline"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
