import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";

interface ThemeContextValue {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }

  const requestedTheme = new URLSearchParams(window.location.search).get("theme");
  if (requestedTheme === "light" || requestedTheme === "dark") {
    window.localStorage.setItem("aido-theme", requestedTheme);
    return requestedTheme;
  }

  if (isPublicLightRoute(window.location.pathname)) {
    return "light";
  }

  const savedTheme = window.localStorage.getItem("aido-theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return "light";
}

function isPublicLightRoute(pathname: string): boolean {
  const pathOnly = pathname.split("?")[0] || "/";
  return [
    /^\/$/,
    /^\/w(?:\/|$)/,
    /^\/rsvp(?:\/|$)/,
    /^\/save-the-date(?:\/|$)/,
    /^\/collect(?:\/|$)/,
    /^\/invite(?:\/|$)/,
    /^\/sign-in(?:\/|$)/,
    /^\/sign-up(?:\/|$)/,
    /^\/terms\/?$/,
    /^\/privacy\/?$/,
    /^\/security\/?$/,
    /^\/data-handling\/?$/,
    /^\/beta\/?$/,
    /^\/help\/updates-improvements\/?$/,
  ].some((pattern) => pattern.test(pathOnly));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [theme, setThemeState] = useState<"light" | "dark">(getInitialTheme);

  useEffect(() => {
    const forcedLight = isPublicLightRoute(location);
    const appliedTheme = forcedLight ? "light" : theme;
    document.documentElement.classList.toggle("dark", appliedTheme === "dark");
    if (!forcedLight) localStorage.setItem("aido-theme", appliedTheme);
  }, [location, theme]);

  const setTheme = (nextTheme: "light" | "dark") => setThemeState(nextTheme);
  const toggleTheme = () => setThemeState((current) => current === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
