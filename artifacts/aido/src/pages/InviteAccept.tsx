import { useState, useEffect, useRef } from "react";
import { apiFetch, authFetch } from "@/lib/authFetch";
import { useRoute, useLocation } from "wouter";
import { useAuth, useUser, useClerk } from "@clerk/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Heart, CheckCircle2, XCircle, Crown, Briefcase, Eye, AlertCircle, Loader2, Mail, ArrowLeft } from "lucide-react";

type CollabRole = "partner" | "planner" | "vendor";
type AuthMode = "signup" | "signin";
type AuthStep = "email" | "code";

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

  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const { setActiveWorkspace } = useWorkspace();

  function generateRandomPassword(): string {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const symbols = "!@#$%^&*-_=+";
    const all = upper + lower + digits + symbols;
    function pick(set: string): string {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return set[buf[0] % set.length];
    }
    const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
    const fillCount = 32 - required.length;
    const fill = new Uint32Array(fillCount);
    crypto.getRandomValues(fill);
    const chars = required.concat(Array.from(fill, (n) => all[n % all.length]));
    const shuffleBuf = new Uint32Array(chars.length);
    crypto.getRandomValues(shuffleBuf);
    for (let i = chars.length - 1; i > 0; i--) {
      const j = shuffleBuf[i] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
  }

  async function waitForSignUpClient() {
    const start = Date.now();
    while (Date.now() - start < 8000) {
      if (clerk.loaded && clerk.client?.signUp) return clerk.client.signUp;
      await new Promise((res) => setTimeout(res, 80));
    }
    return clerk.client?.signUp ?? null;
  }

  async function waitForSignInClient() {
    const start = Date.now();
    while (Date.now() - start < 8000) {
      if (clerk.loaded && clerk.client?.signIn) return clerk.client.signIn;
      await new Promise((res) => setTimeout(res, 80));
    }
    return clerk.client?.signIn ?? null;
  }

  // Auth state
  const [authStep, setAuthStep] = useState<AuthStep>("email");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingAccept, setPendingAccept] = useState(false);
  const [signInEmailAddressId, setSignInEmailAddressId] = useState<string | null>(null);

  // Invite page state
  const [declined, setDeclined] = useState(false);
  const acceptCalledRef = useRef(false);

  // ── Fetch invite metadata (public, no auth needed) ────────────────────────
  const { data: invite, isLoading, isError } = useQuery({
    queryKey: ["invite", token],
    queryFn: async () => {
      const r = await apiFetch(`/api/invite/${token}`);
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

  // ── Accept mutation ───────────────────────────────────────────────────────
  const acceptMutation = useMutation({
    mutationFn: async () => {
      const r = await authFetch(`/api/invite/${token}/accept`, { method: "POST" });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Failed to accept invitation.");
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
      setLocation(`/workspace/${data.profileId}`);
    },
    onError: (err: Error) => {
      setAuthError(err.message);
    },
  });

  // ── Decline mutation ──────────────────────────────────────────────────────
  const declineMutation = useMutation({
    mutationFn: async () => {
      const r = await authFetch(`/api/invite/${token}/decline`, { method: "POST" });
      if (!r.ok) throw new Error("Failed to decline");
    },
    onSuccess: () => setDeclined(true),
  });

  // ── Auto-accept once Clerk session is live after passwordless auth ────────
  useEffect(() => {
    if (isSignedIn && pendingAccept && !acceptCalledRef.current) {
      acceptCalledRef.current = true;
      setPendingAccept(false);
      acceptMutation.mutate();
    }
  }, [isSignedIn, pendingAccept]);

  // ── Redirect if invite already accepted by this user ─────────────────────
  useEffect(() => {
    if (isSignedIn && invite?.status === "active") {
      setActiveWorkspace({
        profileId: invite.profileId,
        role: invite.role,
        partner1Name: invite.partner1Name,
        partner2Name: invite.partner2Name,
        weddingDate: invite.weddingDate,
      });
      setLocation(`/workspace/${invite.profileId}`);
    }
  }, [isSignedIn, invite?.status]);

  // ── Passwordless email submit ─────────────────────────────────────────────
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;

    setIsSending(true);
    setAuthError(null);

    try {
      const liveSignUp = await waitForSignUpClient();
      if (!liveSignUp) {
        setAuthError("Auth is still loading. Please try again in a moment.");
        return;
      }

      // Try sign-up first — works for new users
      try {
        await liveSignUp.create({ emailAddress: trimmedEmail, password: generateRandomPassword() });
        await liveSignUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setAuthMode("signup");
        setAuthStep("code");
      } catch (signUpErr: any) {
        const errCode: string = signUpErr?.errors?.[0]?.code ?? "";
        const isExisting = errCode === "form_identifier_exists" || errCode.includes("exists");

        if (isExisting) {
          // User already has an account — sign them in with email code
          const liveSignIn = await waitForSignInClient();
          if (!liveSignIn) {
            setAuthError("Auth is still loading. Please try again in a moment.");
            return;
          }
          const si = await liveSignIn.create({ identifier: trimmedEmail });
          const factor = (si.supportedFirstFactors as any[] | undefined)?.find(
            (f: any) => f.strategy === "email_code"
          );
          if (!factor) {
            throw new Error("Passwordless sign-in is not enabled on this account. Please contact support.");
          }
          await liveSignIn.prepareFirstFactor({
            strategy: "email_code",
            emailAddressId: factor.emailAddressId,
          });
          setSignInEmailAddressId(factor.emailAddressId);
          setAuthMode("signin");
          setAuthStep("code");
        } else {
          setAuthError(
            signUpErr?.errors?.[0]?.longMessage ??
            signUpErr?.message ??
            "Could not send a verification code. Please try again."
          );
        }
      }
    } catch (err: any) {
      setAuthError(
        err?.errors?.[0]?.longMessage ??
        err?.message ??
        "Could not send a verification code. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  }

  // ── OTP verification ──────────────────────────────────────────────────────
  async function handleOtpVerify(otpValue: string) {
    if (otpValue.length < 6) return;
    setIsVerifying(true);
    setAuthError(null);

    try {
      let result: any;
      if (authMode === "signup") {
        const liveSignUp = await waitForSignUpClient();
        if (!liveSignUp) throw new Error("Auth is still loading. Please try again.");
        result = await liveSignUp.attemptEmailAddressVerification({ code: otpValue });
      } else {
        const liveSignIn = await waitForSignInClient();
        if (!liveSignIn) throw new Error("Auth is still loading. Please try again.");
        result = await liveSignIn.attemptFirstFactor({ strategy: "email_code", code: otpValue });
      }

      if (result.status === "complete" && result.createdSessionId && clerk.setActive) {
        await clerk.setActive({ session: result.createdSessionId });
        setPendingAccept(true);
      } else if (result.status === "complete") {
        // Session already active (rare fallback)
        setPendingAccept(true);
      } else {
        throw new Error("Verification incomplete. Please try again.");
      }
    } catch (err: any) {
      setAuthError(
        err?.errors?.[0]?.longMessage ??
        err?.message ??
        "Invalid code. Please try again."
      );
      setOtp("");
    } finally {
      setIsVerifying(false);
    }
  }

  // Auto-submit when all 6 digits are entered
  function handleOtpChange(value: string) {
    setOtp(value);
    if (value.length === 6) {
      handleOtpVerify(value);
    }
  }

  // ── Resend code ───────────────────────────────────────────────────────────
  async function handleResend() {
    setAuthError(null);
    setOtp("");
    try {
      if (authMode === "signup") {
        const liveSignUp = await waitForSignUpClient();
        if (liveSignUp) await liveSignUp.prepareEmailAddressVerification({ strategy: "email_code" });
      } else if (signInEmailAddressId) {
        const liveSignIn = await waitForSignInClient();
        if (liveSignIn) await liveSignIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: signInEmailAddressId });
      }
    } catch {
      setAuthError("Could not resend code. Please try again.");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render states
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-10 w-48 mx-auto" />
          <Skeleton className="h-64 w-full rounded-2xl" />
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
          <p className="text-muted-foreground">
            This invite link is invalid, has already been used, or has expired.
          </p>
          <Button variant="outline" onClick={() => setLocation("/")}>Go Home</Button>
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

  // Joining/redirecting overlay — shown while accepting or after OTP completes
  const isJoining = pendingAccept || acceptMutation.isPending;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">

        {/* Logo / Brand */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-primary font-serif font-bold text-2xl mb-4">
            <Heart className="h-7 w-7 fill-primary" />
            A.IDO
          </div>
          <h1 className="text-3xl font-serif text-foreground">You're Invited!</h1>
          <p className="text-muted-foreground text-base">
            You've been invited to collaborate on a wedding workspace.
          </p>
        </div>

        {/* Invite card */}
        <div className="bg-card border border-border/60 rounded-2xl p-6 space-y-5">

          {/* Wedding info */}
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-serif text-primary">
              {invite.partner1Name} & {invite.partner2Name}
            </h2>
            {(invite.weddingDate || invite.venue) && (
              <p className="text-muted-foreground text-sm">
                {[invite.weddingDate, invite.venue].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          {/* Role badge */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/15">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <RoleIcon className={`h-5 w-5 ${RoleCfg?.color ?? "text-primary"}`} />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">
                Role: {RoleCfg?.label ?? invite.role}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">{RoleCfg?.description}</p>
            </div>
          </div>

          {/* Invite already used */}
          {invite.status !== "pending" && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl text-sm text-amber-800 dark:text-amber-300 text-center">
              This invitation has already been {invite.status === "active" ? "accepted" : invite.status}.
            </div>
          )}

          {/* Error display */}
          {authError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive text-center">
              {authError}
            </div>
          )}

          {/* ── JOINING SPINNER ─────────────────────────────────────── */}
          {isJoining && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Joining workspace…</p>
            </div>
          )}

          {/* ── ALREADY SIGNED IN: show accept / decline ────────────── */}
          {!isJoining && isSignedIn && invite.status === "pending" && (() => {
            const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";
            const inviteDomain = invite.inviteeEmail.split("@")[1] ?? "";
            const userDomain = userEmail.split("@")[1] ?? "";
            const likelyMismatch = inviteDomain && userDomain && inviteDomain !== userDomain;
            return (
              <div className="space-y-3">
                {likelyMismatch && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl text-sm text-amber-800 dark:text-amber-300">
                    <strong>Wrong account?</strong> This invite was sent to{" "}
                    <strong>{invite.inviteeEmail}</strong>. You're signed in as{" "}
                    <strong>{userEmail}</strong>.
                  </div>
                )}
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
              </div>
            );
          })()}

          {/* ── NOT SIGNED IN: passwordless auth flow ───────────────── */}
          {!isJoining && !isSignedIn && invite.status === "pending" && (
            <div className="space-y-4">

              {authStep === "email" && (
                <>
                  <p className="text-sm text-muted-foreground text-center">
                    Enter the email address this invite was sent to. We'll send you a
                    verification code — no password needed.
                  </p>
                  {invite.inviteeEmail && (
                    <p className="text-xs text-center text-muted-foreground">
                      Invite sent to: <span className="font-medium text-foreground">{invite.inviteeEmail}</span>
                    </p>
                  )}
                  <form onSubmit={handleEmailSubmit} className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isSending}
                        autoFocus
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full gap-2"
                      disabled={isSending || !email.trim()}
                    >
                      {isSending
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending code…</>
                        : "Continue with email"}
                    </Button>
                  </form>
                </>
              )}

              {authStep === "code" && (
                <>
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => { setAuthStep("email"); setOtp(""); setAuthError(null); }}
                  >
                    <ArrowLeft className="h-3 w-3" /> Back
                  </button>

                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Check your email
                    </p>
                    <p className="text-sm text-muted-foreground">
                      We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
                      {authMode === "signin" ? " (Signing in to existing account.)" : " (Creating your account.)"}
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otp}
                      onChange={handleOtpChange}
                      disabled={isVerifying}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, i) => (
                          <InputOTPSlot key={i} index={i} className="h-12 w-11 text-base" />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {isVerifying && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying…
                    </div>
                  )}

                  <p className="text-xs text-center text-muted-foreground">
                    Didn't receive a code?{" "}
                    <button
                      className="text-primary underline hover:no-underline"
                      onClick={handleResend}
                    >
                      Resend
                    </button>
                  </p>
                </>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
