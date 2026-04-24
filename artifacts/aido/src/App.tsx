import { useEffect, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { ClerkProvider, SignIn, SignUp, useClerk, useAuth, useSignIn, useSignUp, Show } from "@clerk/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { setFetchTokenGetter } from "@/lib/authFetch";
import { AppLayout } from "@/components/layout/AppLayout";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useGetProfile } from "@workspace/api-client-react";
import i18n, { LANG_NAME_TO_CODE } from "@/i18n";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import Timeline from "@/pages/Timeline";
import Budget from "@/pages/Budget";
import Checklist from "@/pages/Checklist";
import Vendors from "@/pages/Vendors";
import DayOf from "@/pages/DayOf";
import Admin from "@/pages/Admin";
import Settings from "@/pages/Settings";
import Help from "@/pages/Help";
import SeatingChart from "@/pages/SeatingChart";
import InviteAccept from "@/pages/InviteAccept";
import GuestCollect from "@/pages/GuestCollect";
import SharedWorkspace from "@/pages/SharedWorkspace";
import Guests from "@/pages/Guests";
import Hotels from "@/pages/Hotels";
import WeddingParty from "@/pages/WeddingParty";
import Contracts from "@/pages/Contracts";
import Aria from "@/pages/Aria";
import Terms from "@/pages/Terms";
import NotFound from "@/pages/not-found";
import VideoTemplate from "@/components/video/VideoTemplate";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number })?.status;
        if (status === 404 || status === 401 || status === 403) return false;
        return failureCount < 2;
      },
    },
  },
});

const clerkAppearance = {
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
  },
  variables: {
    colorPrimary: "#D4A017",
    colorBackground: "#120c1e",
    colorInput: "#1e1530",
    colorForeground: "#ffffff",
    colorMutedForeground: "#b8a9cc",
    colorInputForeground: "#ffffff",
    colorNeutral: "#7c6a9a",
    colorDanger: "#f87171",
    borderRadius: "0.75rem",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontFamilyButtons: "system-ui, sans-serif",
    fontSize: "15px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-2xl rounded-2xl w-full overflow-hidden border border-amber-500/20",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: { color: "#ffffff", fontFamily: "Georgia, serif" },
    headerSubtitle: { color: "#b8a9cc" },
    socialButtonsBlockButtonText: { color: "#ffffff" },
    socialButtonsBlockButtonArrow: { color: "#ffffff" },
    formFieldLabel: { color: "#e2d9f3" },
    footerActionLink: { color: "#D4A017" },
    footerActionText: { color: "#b8a9cc" },
    dividerText: { color: "#9c8ab8" },
    identityPreviewEditButton: { color: "#D4A017" },
    formFieldSuccessText: { color: "#86efac" },
    alertText: { color: "#ffffff" },
    logoBox: "flex justify-center py-4",
    logoImage: "h-16 w-16",
    socialButtonsBlockButton: { border: "1px solid rgba(255,255,255,0.15)", color: "#ffffff" },
    formButtonPrimary: { background: "linear-gradient(135deg,#B8860B,#D4A017,#F5C842)", color: "#ffffff", borderRadius: "0.5rem" },
    formFieldInput: { border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.5rem", background: "rgba(255,255,255,0.05)", color: "#ffffff" },
    footerAction: { borderTop: "1px solid rgba(255,255,255,0.1)" },
    dividerLine: { background: "rgba(255,255,255,0.12)" },
    main: "px-6 pb-6",
  },
};

function AuthPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-10 gap-6"
      style={{ background: "linear-gradient(135deg, #09060f 0%, #130b22 50%, #09060f 100%)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,160,23,0.12) 0%, transparent 60%)" }}
      />
      <div className="relative flex flex-col items-center gap-2">
        <img src="/logo.png" alt="A.IDO" className="h-24 w-auto object-contain" style={{ filter: "drop-shadow(0 0 20px rgba(212,160,23,0.4))" }} />
        <p className="text-sm font-medium tracking-widest uppercase" style={{ color: "#b8a9cc" }}>AI Wedding Planning OS</p>
      </div>
      <div className="relative w-full max-w-md">
        {children}
      </div>
    </div>
  );
}

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <AuthPageWrapper>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
      />
    </AuthPageWrapper>
  );
}

function SignUpPage() {
  return (
    <AuthPageWrapper>
      <CustomSignUpForm />
    </AuthPageWrapper>
  );
}

function CustomSignUpForm() {
  const { signIn, isLoaded: signInLoaded, setActive } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [emailAddressId, setEmailAddressId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendInfo, setResendInfo] = useState<string | null>(null);

  const apiBase = `${basePath}api`.replace(/\/+/g, "/");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(apiBase + "/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, firstName, lastName }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data?.error || "Could not create account. Try a different email.");
        setSubmitting(false);
        return;
      }
      setEmailAddressId(data?.emailAddressId ?? null);
      setStep("verify");
      setSubmitting(false);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || "Something went wrong. Please try again.";
      setError(msg);
      setSubmitting(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResendInfo(null);
    if (!code.trim()) {
      setError("Enter the code from your email.");
      return;
    }
    if (!emailAddressId) {
      setError("Verification session expired. Please sign up again.");
      return;
    }
    if (!signInLoaded || !setActive) {
      setError("Auth is still loading. Please try again in a moment.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(apiBase + "/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAddressId, code: code.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data?.error || "Invalid or expired code.");
        setSubmitting(false);
        return;
      }
      const attempt = await signIn.create({ identifier: email.trim(), password });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        setLocation("/dashboard");
      } else {
        setLocation("/sign-in");
      }
    } catch (err: unknown) {
      const msg =
        (err as { errors?: Array<{ longMessage?: string; message?: string }> })?.errors?.[0]?.longMessage ||
        (err as { errors?: Array<{ longMessage?: string; message?: string }> })?.errors?.[0]?.message ||
        (err as Error)?.message ||
        "Something went wrong. Please try again.";
      setError(msg);
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResendInfo(null);
    if (!emailAddressId) return;
    try {
      const r = await fetch(apiBase + "/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAddressId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data?.error || "Could not resend code.");
        return;
      }
      setResendInfo("A new code has been sent. Check your inbox and spam folder.");
    } catch (err: unknown) {
      setError((err as Error)?.message || "Could not resend code.");
    }
  }

  async function handleOAuth(strategy: "oauth_google" | "oauth_apple") {
    if (!signUpLoaded) return;
    setError(null);
    try {
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: `${basePath}/sign-up`,
        redirectUrlComplete: `${basePath}/dashboard`,
      });
    } catch (err: unknown) {
      const msg =
        (err as { errors?: Array<{ longMessage?: string; message?: string }> })?.errors?.[0]?.longMessage ||
        (err as Error)?.message ||
        "OAuth sign-up failed.";
      setError(msg);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.65rem 0.85rem",
    borderRadius: "0.5rem",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "#ffffff",
    fontSize: "0.9rem",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    color: "#b8a9cc",
    fontSize: "0.78rem",
    fontWeight: 500,
    marginBottom: "0.35rem",
    display: "block",
  };
  const oauthBtn: React.CSSProperties = {
    width: "100%",
    padding: "0.65rem",
    borderRadius: "0.5rem",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "#ffffff",
    fontSize: "0.9rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
  };

  return (
    <div
      style={{
        background: "rgba(20,12,35,0.7)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "0.85rem",
        padding: "1.5rem",
        backdropFilter: "blur(10px)",
      }}
    >
      {step === "verify" ? (
        <>
          <h2 style={{ color: "#ffffff", fontSize: "1.4rem", fontWeight: 600, marginBottom: "0.35rem" }}>
            Check your email
          </h2>
          <p style={{ color: "#b8a9cc", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            We sent a 6-digit verification code to <strong style={{ color: "#ffffff" }}>{email}</strong>.
          </p>
          <p style={{ color: "#F5C842", fontSize: "0.78rem", marginBottom: "1.25rem", fontWeight: 500 }}>
            Don't see it? Please check your spam or junk folder.
          </p>

          <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div>
              <label style={labelStyle}>Verification code</label>
              <input
                style={{ ...inputStyle, letterSpacing: "0.4em", textAlign: "center", fontSize: "1.1rem" }}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                required
              />
            </div>

            {error && (
              <div
                style={{
                  color: "#ff8a8a",
                  background: "rgba(255,80,80,0.08)",
                  border: "1px solid rgba(255,80,80,0.25)",
                  borderRadius: "0.5rem",
                  padding: "0.55rem 0.75rem",
                  fontSize: "0.82rem",
                }}
              >
                {error}
              </div>
            )}
            {resendInfo && (
              <div
                style={{
                  color: "#9ee69e",
                  background: "rgba(80,255,120,0.06)",
                  border: "1px solid rgba(80,255,120,0.2)",
                  borderRadius: "0.5rem",
                  padding: "0.55rem 0.75rem",
                  fontSize: "0.82rem",
                }}
              >
                {resendInfo}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "0.7rem",
                borderRadius: "0.5rem",
                border: "none",
                background: "linear-gradient(135deg,#B8860B,#D4A017,#F5C842)",
                color: "#ffffff",
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
                marginTop: "0.25rem",
              }}
            >
              {submitting ? "Verifying..." : "Verify and continue"}
            </button>
          </form>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem", fontSize: "0.82rem" }}>
            <button
              type="button"
              onClick={() => { setStep("form"); setError(null); setResendInfo(null); setCode(""); }}
              style={{ background: "none", border: "none", color: "#b8a9cc", cursor: "pointer", padding: 0 }}
            >
              ← Use a different email
            </button>
            <button
              type="button"
              onClick={handleResend}
              style={{ background: "none", border: "none", color: "#F5C842", cursor: "pointer", padding: 0, fontWeight: 500 }}
            >
              Resend code
            </button>
          </div>
        </>
      ) : (
        <>
      <h2 style={{ color: "#ffffff", fontSize: "1.4rem", fontWeight: 600, marginBottom: "0.35rem" }}>
        Create your account
      </h2>
      <p style={{ color: "#b8a9cc", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
        Welcome! Let's get your wedding planning started.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
        <button type="button" onClick={() => handleOAuth("oauth_google")} style={oauthBtn}>
          Continue with Google
        </button>
        <button type="button" onClick={() => handleOAuth("oauth_apple")} style={oauthBtn}>
          Continue with Apple
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", margin: "1rem 0" }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
        <span style={{ color: "#b8a9cc", fontSize: "0.75rem" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
          <div>
            <label style={labelStyle}>First name</label>
            <input style={inputStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          </div>
          <div>
            <label style={labelStyle}>Last name</label>
            <input style={inputStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Email address</label>
          <input
            type="email"
            required
            style={inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            required
            style={inputStyle}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
          />
        </div>

        {error && (
          <div
            style={{
              color: "#ff8a8a",
              background: "rgba(255,80,80,0.08)",
              border: "1px solid rgba(255,80,80,0.25)",
              borderRadius: "0.5rem",
              padding: "0.55rem 0.75rem",
              fontSize: "0.82rem",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            padding: "0.7rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "linear-gradient(135deg,#B8860B,#D4A017,#F5C842)",
            color: "#ffffff",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.7 : 1,
            marginTop: "0.25rem",
          }}
        >
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p style={{ color: "#b8a9cc", fontSize: "0.82rem", marginTop: "1rem", textAlign: "center" }}>
        Already have an account?{" "}
        <a href={`${basePath}/sign-in`} style={{ color: "#F5C842", fontWeight: 500 }}>
          Sign in
        </a>
      </p>
        </>
      )}
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <AppLayout>
          <Component />
        </AppLayout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkTokenSetup() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    setFetchTokenGetter(() => getToken());
    return () => {
      setAuthTokenGetter(null);
      setFetchTokenGetter(null);
    };
  }, [getToken]);
  return null;
}

function PendingInviteRedirector() {
  const { isSignedIn, getToken } = useAuth();
  const [location, setLocation] = useLocation();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!isSignedIn) {
      checkedRef.current = false;
      return;
    }
    if (checkedRef.current) return;
    if (location.startsWith("/invite/") || location.startsWith("/sign-in") || location.startsWith("/sign-up")) {
      return;
    }
    checkedRef.current = true;

    (async () => {
      try {
        const token = await getToken();
        const [profileRes, invitesRes] = await Promise.all([
          fetch(`${basePath}/api/profile`, {
            credentials: "include",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
          fetch(`${basePath}/api/invites/pending`, {
            credentials: "include",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
        ]);
        const hasOwnProfile = profileRes.ok;
        if (hasOwnProfile) return;
        if (!invitesRes.ok) return;
        const data = (await invitesRes.json()) as { pending?: Array<{ inviteToken: string }> };
        const first = data.pending?.[0];
        if (first?.inviteToken) {
          setLocation(`/invite/${first.inviteToken}`);
        }
      } catch {
        // Silent — non-blocking redirector.
      }
    })();
  }, [isSignedIn, location, getToken, setLocation]);

  return null;
}

function LanguageSyncProvider() {
  const { data: profile } = useGetProfile();
  useEffect(() => {
    if (!profile?.preferredLanguage) return;
    // Only seed the UI language from the workspace profile if THIS user has
    // never picked one themselves. Otherwise each collaborator's choice would
    // overwrite the others. The shared profile.preferredLanguage continues to
    // drive AI/vendor-email language at the workspace level.
    if (localStorage.getItem("aido_language")) return;
    const code = LANG_NAME_TO_CODE[profile.preferredLanguage] ?? "en";
    if (i18n.language !== code) {
      i18n.changeLanguage(code);
      localStorage.setItem("aido_language", code);
    }
  }, [profile?.preferredLanguage]);
  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/invite/:token" component={InviteAccept} />
      <Route path="/collect/:token" component={GuestCollect} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
      <Route path="/timeline" component={() => <ProtectedRoute component={Timeline} />} />
      <Route path="/budget" component={() => <ProtectedRoute component={Budget} />} />
      <Route path="/checklist" component={() => <ProtectedRoute component={Checklist} />} />
      <Route path="/vendors" component={() => <ProtectedRoute component={Vendors} />} />
      <Route path="/day-of" component={() => <ProtectedRoute component={DayOf} />} />
      <Route path="/admin" component={() => <ProtectedRoute component={Admin} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/help" component={() => <ProtectedRoute component={Help} />} />
      <Route path="/seating-chart" component={() => <ProtectedRoute component={SeatingChart} />} />
      <Route path="/guests" component={() => <ProtectedRoute component={Guests} />} />
      <Route path="/hotels" component={() => <ProtectedRoute component={Hotels} />} />
      <Route path="/wedding-party" component={() => <ProtectedRoute component={WeddingParty} />} />
      <Route path="/contracts" component={() => <ProtectedRoute component={Contracts} />} />
      <Route path="/aria" component={() => <ProtectedRoute component={Aria} />} />
      <Route path="/workspace/:profileId" component={() => <ProtectedRoute component={SharedWorkspace} />} />
      <Route path="/terms" component={Terms} />
      <Route path="/promo" component={VideoTemplate} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl || undefined}
      appearance={clerkAppearance}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to continue planning your perfect day",
          },
        },
        signUp: {
          start: {
            title: "Begin your journey",
            subtitle: "Create your free A.IDO account",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkTokenSetup />
        <ClerkQueryClientCacheInvalidator />
        <PendingInviteRedirector />
        <LanguageSyncProvider />
        <WorkspaceProvider>
          <ThemeProvider>
            <TooltipProvider>
              <Router />
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </WorkspaceProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
