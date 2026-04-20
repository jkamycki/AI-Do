import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { ClerkProvider, SignIn, SignUp, useClerk, useAuth, Show } from "@clerk/react";
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
import VendorEmail from "@/pages/VendorEmail";
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
  },
  variables: {
    colorPrimary: "#D4A017",
    colorBackground: "#120c1e",
    colorInputBackground: "#1e1530",
    colorText: "#ffffff",
    colorTextSecondary: "#b8a9cc",
    colorInputText: "#ffffff",
    colorNeutral: "#7c6a9a",
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
    dividerText: { color: "#7c6a9a" },
    identityPreviewEditButton: { color: "#D4A017" },
    formFieldSuccessText: { color: "#86efac" },
    alertText: { color: "#ffffff" },
    logoBox: "flex justify-center py-4",
    logoImage: "h-16 w-16",
    socialButtonsBlockButton: "border border-white/15 hover:bg-white/8 !text-white",
    formButtonPrimary: "!bg-amber-600 hover:!bg-amber-500 !text-white rounded-lg",
    formFieldInput: "!border-white/15 focus:!border-amber-400 rounded-lg !bg-white/5 !text-white",
    footerAction: "border-t border-white/10",
    dividerLine: "!bg-white/10",
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
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <AuthPageWrapper>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
      />
    </AuthPageWrapper>
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

function LanguageSyncProvider() {
  const { data: profile } = useGetProfile();
  useEffect(() => {
    if (!profile?.preferredLanguage) return;
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
      <Route path="/vendor-email" component={() => <ProtectedRoute component={VendorEmail} />} />
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
