import { useEffect, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { ClerkProvider, useClerk, useAuth, useSignIn, useSignUp, Show, AuthenticateWithRedirectCallback } from "@clerk/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { setFetchTokenGetter, authFetch } from "@/lib/authFetch";
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
  return (
    <AuthPageWrapper>
      <CustomSignInForm />
    </AuthPageWrapper>
  );
}

function CustomSignInForm() {
  const clerk = useClerk();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"code_request" | "code_verify">(
    "code_request",
  );
  const [email, setEmail] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<"oauth_google" | null>(null);

  useEffect(() => {
    try {
      const msg = sessionStorage.getItem("aido_signin_no_account_msg");
      if (msg) {
        setInfo(msg);
        sessionStorage.removeItem("aido_signin_no_account_msg");
      }
    } catch {}
  }, []);

  function extractError(err: unknown, fallback: string): string {
    const e = err as { errors?: Array<{ longMessage?: string; message?: string; code?: string }> };
    const first = e?.errors?.[0];
    if (first?.code === "form_identifier_not_found") {
      return "We couldn't find an account with that email. If you previously deleted your account, please sign up again.";
    }
    return first?.longMessage || first?.message || (err as Error)?.message || fallback;
  }

  async function handleSendLoginCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setSubmitting(true);
    try {
      const signInClient = await waitForSignInClient();
      if (!signInClient) {
        setError("Auth is still loading. Please try again in a moment.");
        setSubmitting(false);
        return;
      }
      // Step 1: create the sign-in attempt by identifier alone (no password).
      const attempt = await signInClient.create({ identifier: email.trim() });
      // Step 2: locate the email_code first-factor on this account.
      const factors =
        (attempt as unknown as {
          supportedFirstFactors?: Array<{
            strategy?: string;
            emailAddressId?: string;
          }>;
        }).supportedFirstFactors ?? [];
      const emailFactor = factors.find((f) => f.strategy === "email_code");
      if (!emailFactor?.emailAddressId) {
        setError(
          "We couldn't send a code to this email. Try signing in with Google instead.",
        );
        setSubmitting(false);
        return;
      }
      // Step 3: ask Clerk to email the 6-digit code.
      await signInClient.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: emailFactor.emailAddressId,
      });
      setMode("code_verify");
      setInfo(`We sent a 6-digit sign-in code to ${email.trim()}. Enter it below.`);
    } catch (err) {
      setError(extractError(err, "Could not send sign-in code. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyLoginCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!loginCode.trim()) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    try {
      const signInClient = await waitForSignInClient();
      if (!signInClient || !clerk.setActive) {
        setError("Auth is still loading. Please try again in a moment.");
        setSubmitting(false);
        return;
      }
      const result = await signInClient.attemptFirstFactor({
        strategy: "email_code",
        code: loginCode.trim(),
      });
      if (result.status === "complete" && result.createdSessionId) {
        await clerk.setActive({ session: result.createdSessionId });
        setLocation("/dashboard");
      } else {
        setError("Sign in incomplete. Please try again.");
        setSubmitting(false);
      }
    } catch (err) {
      setError(extractError(err, "Invalid or expired code. Please try again."));
      setSubmitting(false);
    }
  }

  async function waitForSignInClient() {
    const start = Date.now();
    while (Date.now() - start < 8000) {
      if (clerk.loaded && clerk.client?.signIn) return clerk.client.signIn;
      await new Promise((res) => setTimeout(res, 80));
    }
    return clerk.client?.signIn ?? null;
  }

  async function handleGoogle() {
    setError(null);
    setOauthLoading("oauth_google");
    try {
      const signInClient = await waitForSignInClient();
      if (!signInClient) {
        setOauthLoading(null);
        setError("Auth is still loading. Please try again in a moment.");
        return;
      }
      // Mark this OAuth flow as a sign-IN attempt (not a sign-up). After the
      // callback we use this flag to detect the case where Clerk silently
      // auto-created a brand new account because the email had no prior
      // account — in that case we delete the new account and bounce the
      // user to the sign-up page with a clear message. The timestamp lets
      // the detector tell apart "account created by THIS flow" (must delete)
      // from "user already had an account from before" (must keep).
      sessionStorage.setItem("aido_oauth_intent", "signin");
      sessionStorage.setItem("aido_oauth_intent_at", String(Date.now()));
      const origin = window.location.origin;
      await signInClient.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${origin}${basePath}/sso-callback`,
        redirectUrlComplete: `${origin}${basePath}/dashboard`,
      });
    } catch (err) {
      setOauthLoading(null);
      try {
        sessionStorage.removeItem("aido_oauth_intent");
        sessionStorage.removeItem("aido_oauth_intent_at");
      } catch {}
      setError(extractError(err, "Could not start Google sign-in."));
    }
  }

  // One-click sign-in to a fixed test account so the owner can repeatedly
  // sign in without going through email-code verification on every visit.
  // The backend mints a Clerk sign-in token; we consume it via the "ticket"
  // strategy. The endpoint returns 404 unless ENABLE_TEST_ACCOUNT=true is
  // set on the server.
  async function handleTestAccount() {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${basePath}/api/auth/test-signin`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data?.error || "Could not start the test session.");
      }
      const { token } = (await res.json()) as { token?: string };
      if (!token) throw new Error("No test session token was returned.");
      const signInClient = await waitForSignInClient();
      if (!signInClient || !clerk.setActive) {
        throw new Error("Auth is still loading. Please try again in a moment.");
      }
      // Clear any stale OAuth-intent flags from a previously abandoned Google
      // flow so the no-account detector can't misfire on the test account.
      try {
        sessionStorage.removeItem("aido_oauth_intent");
        sessionStorage.removeItem("aido_oauth_intent_at");
      } catch {}
      const attempt = await (
        signInClient as unknown as {
          create: (p: { strategy: string; ticket: string }) => Promise<{
            status?: string;
            createdSessionId?: string;
          }>;
        }
      ).create({ strategy: "ticket", ticket: token });
      if (attempt.status === "complete" && attempt.createdSessionId) {
        await clerk.setActive({ session: attempt.createdSessionId });
        setLocation("/dashboard");
      } else {
        throw new Error("Test sign-in did not complete. Please try again.");
      }
    } catch (err) {
      setError(extractError(err, "Could not sign in to the test account."));
      setSubmitting(false);
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
      <h2 style={{ color: "#ffffff", fontSize: "1.4rem", fontWeight: 600, marginBottom: "0.35rem" }}>
        Sign in
      </h2>
      <p style={{ color: "#b8a9cc", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
        Welcome back to A.IDO.
      </p>

      {info && (
        <div
          role="status"
          style={{
            color: "#fde68a",
            background: "rgba(245, 158, 11, 0.10)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: "0.5rem",
            padding: "0.55rem 0.75rem",
            fontSize: "0.82rem",
            marginBottom: "0.85rem",
          }}
        >
          {info}
        </div>
      )}

      {error && (
        <div
          style={{
            color: "#ff8a8a",
            background: "rgba(255,80,80,0.08)",
            border: "1px solid rgba(255,80,80,0.25)",
            borderRadius: "0.5rem",
            padding: "0.55rem 0.75rem",
            fontSize: "0.82rem",
            marginBottom: "0.85rem",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          type="button"
          onClick={handleGoogle}
          disabled={oauthLoading !== null}
          style={{ ...oauthBtn, opacity: oauthLoading ? 0.7 : 1, cursor: oauthLoading ? "wait" : "pointer" }}
        >
          {oauthLoading === "oauth_google" ? "Redirecting to Google…" : "Continue with Google"}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", margin: "1rem 0" }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
        <span style={{ color: "#b8a9cc", fontSize: "0.75rem" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
      </div>

      {mode === "code_request" && (
        <form onSubmit={handleSendLoginCode} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <p style={{ color: "#b8a9cc", fontSize: "0.85rem", margin: 0 }}>
            Enter the email address for your A.IDO account. We'll send you a 6-digit code to sign in.
          </p>
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
            }}
          >
            {submitting ? "Sending code..." : "Send sign-in code"}
          </button>

          <p style={{ color: "#b8a9cc", fontSize: "0.82rem", marginTop: "0.5rem", textAlign: "center" }}>
            Don't have an account?{" "}
            <a href={`${basePath}/sign-up`} style={{ color: "#F5C842", fontWeight: 500 }}>
              Sign up
            </a>
          </p>
        </form>
      )}

      {mode === "code_verify" && (
        <form onSubmit={handleVerifyLoginCode} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <p style={{ color: "#F5C842", fontSize: "0.78rem", margin: 0, fontWeight: 500 }}>
            Don't see it? Please check your spam or junk folder.
          </p>
          <div>
            <label style={labelStyle}>6-digit sign-in code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              style={{ ...inputStyle, letterSpacing: "0.4em", textAlign: "center", fontSize: "1.1rem" }}
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="123456"
            />
          </div>
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
            }}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setInfo(null);
              setLoginCode("");
              setMode("code_request");
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#b8a9cc",
              fontSize: "0.82rem",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            ← Use a different email
          </button>
        </form>
      )}

      <div
        style={{
          marginTop: "1.25rem",
          paddingTop: "0.85rem",
          borderTop: "1px dashed rgba(255,255,255,0.08)",
          textAlign: "center",
        }}
      >
        <button
          type="button"
          onClick={handleTestAccount}
          disabled={submitting}
          style={{
            background: "transparent",
            border: "none",
            color: "#8a7ba8",
            fontSize: "0.78rem",
            cursor: submitting ? "not-allowed" : "pointer",
            textDecoration: "underline",
            textUnderlineOffset: "2px",
            padding: 0,
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "Signing in…" : "Sign in to test account"}
        </button>
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <AuthPageWrapper>
      <CustomSignUpForm />
    </AuthPageWrapper>
  );
}

function SsoCallbackPage() {
  return (
    <AuthPageWrapper>
      <div
        style={{
          background: "rgba(20,12,35,0.7)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "0.85rem",
          padding: "1.5rem",
          textAlign: "center",
          color: "#ffffff",
        }}
      >
        <p style={{ marginBottom: "0.5rem", fontSize: "1rem", fontWeight: 500 }}>Finishing sign in...</p>
        <p style={{ color: "#b8a9cc", fontSize: "0.85rem" }}>One moment while we get you into A.IDO.</p>
        <AuthenticateWithRedirectCallback
          signInFallbackRedirectUrl={`${basePath}/dashboard`}
          signUpFallbackRedirectUrl={`${basePath}/dashboard`}
        />
      </div>
    </AuthPageWrapper>
  );
}

function CustomSignUpForm() {
  const clerk = useClerk();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [, setEmailAddressId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendInfo, setResendInfo] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<"oauth_google" | "oauth_apple" | null>(null);

  // Generate a strong, random password under the hood. The user never sees or
  // uses it — sign-in is via email code or Google. Clerk requires a password
  // at sign-up on this instance, so we satisfy that requirement with random
  // entropy that won't appear in any breach database. We guarantee at least
  // one character from each class (upper/lower/digit/symbol) so the password
  // satisfies Clerk's complexity policy regardless of what's enforced.
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
    const chars = required.concat(
      Array.from(fill, (n) => all[n % all.length]),
    );
    // Fisher–Yates shuffle so required-class chars aren't always at the front.
    const shuffleBuf = new Uint32Array(chars.length);
    crypto.getRandomValues(shuffleBuf);
    for (let i = chars.length - 1; i > 0; i--) {
      const j = shuffleBuf[i] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Clear any stale OAuth-intent flags from a previously abandoned Google
    // flow so they can't trigger the "no-account" detector on this signup.
    try {
      sessionStorage.removeItem("aido_oauth_intent");
      sessionStorage.removeItem("aido_oauth_intent_at");
    } catch {}
    if (!signUpLoaded || !signUp) {
      setError("Auth is still loading. Please try again in a moment.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setSubmitting(true);
    try {
      // Use Clerk's frontend SDK so the email-verification code is the proof
      // of ownership before any session is issued. This is the secure flow.
      // The password is generated under the hood with strong entropy and
      // never shown to the user — sign-in is exclusively via email code or
      // Google. We satisfy Clerk's password requirement without exposing one.
      await signUp.create({
        emailAddress: email.trim(),
        password: generateRandomPassword(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      const eaId =
        (signUp as unknown as { emailAddressId?: string }).emailAddressId ?? null;
      setEmailAddressId(eaId);
      setStep("verify");
      setSubmitting(false);
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

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResendInfo(null);
    if (!signUpLoaded || !signUp) {
      setError("Auth is still loading. Please try again in a moment.");
      return;
    }
    if (!code.trim()) {
      setError("Enter the code from your email.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });
      if (result.status === "complete" && result.createdSessionId && clerk.setActive) {
        await clerk.setActive({ session: result.createdSessionId });
        setLocation("/dashboard");
      } else {
        setError("Account created. Please sign in to continue.");
        setLocation("/sign-in");
      }
    } catch (err: unknown) {
      const msg =
        (err as { errors?: Array<{ longMessage?: string; message?: string }> })?.errors?.[0]?.longMessage ||
        (err as { errors?: Array<{ longMessage?: string; message?: string }> })?.errors?.[0]?.message ||
        (err as Error)?.message ||
        "Invalid or expired code.";
      setError(msg);
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResendInfo(null);
    if (!signUpLoaded || !signUp) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setResendInfo("A new code has been sent. Check your inbox and spam folder.");
    } catch (err: unknown) {
      const msg =
        (err as { errors?: Array<{ longMessage?: string; message?: string }> })?.errors?.[0]?.longMessage ||
        (err as Error)?.message ||
        "Could not resend code.";
      setError(msg);
    }
  }

  async function handleOAuth(strategy: "oauth_google" | "oauth_apple") {
    setError(null);
    // Clear any stale sign-IN OAuth intent from a previously abandoned flow,
    // so the no-account detector can never mistake this fresh sign-UP for an
    // auto-created sign-in account.
    try {
      sessionStorage.removeItem("aido_oauth_intent");
      sessionStorage.removeItem("aido_oauth_intent_at");
    } catch {}
    try {
      setOauthLoading(strategy);
      const start = Date.now();
      while (!clerk.loaded && Date.now() - start < 8000) {
        await new Promise((res) => setTimeout(res, 50));
      }
      const signUpClient = clerk.client?.signUp;
      if (!signUpClient) {
        setOauthLoading(null);
        setError("Auth is still loading. Please try again in a moment.");
        return;
      }
      const origin = window.location.origin;
      await signUpClient.authenticateWithRedirect({
        strategy,
        redirectUrl: `${origin}${basePath}/sso-callback`,
        redirectUrlComplete: `${origin}${basePath}/dashboard`,
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
        <button
          type="button"
          onClick={() => handleOAuth("oauth_google")}
          disabled={oauthLoading !== null}
          style={{ ...oauthBtn, opacity: oauthLoading ? 0.7 : 1, cursor: oauthLoading ? "wait" : "pointer" }}
        >
          {oauthLoading === "oauth_google" ? "Redirecting to Google…" : "Continue with Google"}
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
          <p style={{ color: "#8a7ba8", fontSize: "0.72rem", marginTop: "0.4rem", lineHeight: 1.4 }}>
            We'll email you a 6-digit code to verify your account. No password needed — you'll sign in with a code each time, or use Google.
          </p>
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
  // Intentionally a no-op.
  //
  // Previously this component auto-redirected any signed-in user without their
  // own profile to the first pending invite that matched their email address.
  // That conflated "this email has a pending invite" with "this account is the
  // intended recipient", which broke the security expectation that a deleted
  // account followed by a fresh signup with the same email should NOT inherit
  // any prior workspace access.
  //
  // Collaborators must now explicitly click the invite link from their email
  // to accept (the /invite/:token route handles that flow with an explicit
  // email match check). New accounts with previously-invited emails will not
  // be silently linked into any workspace.
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

function NoAccountFromSignInDetector() {
  // When a user clicks "Continue with Google" on the SIGN-IN page and their
  // Google email has no existing A.IDO account, Clerk's OAuth flow silently
  // creates a brand new account and signs them in. From the user's perspective
  // this looks like "it just let me in" — which is wrong: they should have
  // been told to sign up.
  //
  // To enforce that, the sign-in page sets sessionStorage.aido_oauth_intent
  // = "signin" before redirecting to Google. After Clerk completes the OAuth
  // and signs them in, we check: if the Clerk user was created in the last
  // ~2 minutes AND the intent was "signin", that means the account didn't
  // exist — Clerk auto-created it. We delete the just-created account, sign
  // out, and bounce them to the sign-up page with a friendly message.
  const { isSignedIn, isLoaded } = useAuth();
  const clerk = useClerk();
  const [, setLocation] = useLocation();
  const checkedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const userId = clerk.user?.id;
    if (!userId || checkedForUserRef.current === userId) return;
    checkedForUserRef.current = userId;

    let intent: string | null = null;
    let intentAtRaw: string | null = null;
    try {
      intent = sessionStorage.getItem("aido_oauth_intent");
      intentAtRaw = sessionStorage.getItem("aido_oauth_intent_at");
    } catch {}
    if (intent !== "signin") return;
    try {
      sessionStorage.removeItem("aido_oauth_intent");
      sessionStorage.removeItem("aido_oauth_intent_at");
    } catch {}

    const intentAt = intentAtRaw ? Number(intentAtRaw) : 0;
    // The intent must be from a recent OAuth attempt, not stale state from a
    // prior abandoned flow. Anything older than 10 minutes is ignored.
    const INTENT_TTL_MS = 10 * 60 * 1000;
    if (!intentAt || Date.now() - intentAt > INTENT_TTL_MS) return;

    const createdAt = clerk.user?.createdAt
      ? new Date(clerk.user.createdAt).getTime()
      : 0;
    // Only treat as "auto-created by this OAuth flow" if the account was
    // created AFTER we kicked off the flow (with a small clock-skew buffer)
    // AND within a reasonable upper bound for an OAuth round-trip.
    const SKEW_MS = 5_000;
    const MAX_FLOW_MS = 10 * 60 * 1000;
    const wasCreatedDuringThisFlow =
      createdAt > 0 &&
      createdAt > intentAt - SKEW_MS &&
      createdAt < intentAt + MAX_FLOW_MS;
    if (!wasCreatedDuringThisFlow) return;

    (async () => {
      try {
        // Delete the just-created Clerk user + any (empty) DB rows.
        await authFetch(`${basePath}/api/account`, { method: "DELETE" }).catch(() => {});
      } finally {
        try {
          sessionStorage.setItem(
            "aido_signin_no_account_msg",
            "We couldn't find an A.IDO account for that Google email. If you previously deleted your account, please sign up again to create a fresh one.",
          );
        } catch {}
        await clerk.signOut().catch(() => {});
        setLocation("/sign-in");
      }
    })();
  }, [isLoaded, isSignedIn, clerk, setLocation]);

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
      <Route path="/sso-callback" component={SsoCallbackPage} />
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
        <NoAccountFromSignInDetector />
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
