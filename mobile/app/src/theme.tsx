import { createContext, ReactNode, useContext, useMemo } from 'react';

export type ThemeMode = 'light';

export const palette = {
  cream: '#FFF8F4',
  ivory: '#FFFFFF',
  blush: '#F8DDE5',
  blushDeep: '#C85D79',
  rose: '#A93D5B',
  wine: '#552636',
  ink: '#2C2026',
  muted: '#735B64',
  gold: '#BD8A4C',
  goldSoft: '#F4DEBE',
  sage: '#667B5A',
  gray: '#D8CED1',
  white: '#FFFFFF',
  black: '#191215',
};

const lightColors = {
  background: palette.cream,
  backgroundAlt: '#FFFDFB',
  card: 'rgba(255, 255, 255, 0.88)',
  cardStrong: palette.white,
  text: palette.ink,
  muted: palette.muted,
  primary: palette.rose,
  primarySoft: '#F9E7EC',
  accent: palette.gold,
  accentSoft: palette.goldSoft,
  success: palette.sage,
  danger: '#B94848',
  border: 'rgba(85, 38, 54, 0.12)',
  shadow: '#552636',
};

export const fonts = {
  heading: 'PlayfairDisplay_700Bold',
  headingSemi: 'PlayfairDisplay_600SemiBold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
};

export const shadow = {
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 18,
  elevation: 4,
};

type AppThemeContextValue = {
  mode: ThemeMode;
  colors: typeof lightColors;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AppThemeContextValue>(
    () => ({
      mode: 'light',
      colors: lightColors,
      setMode: () => {},
      toggleMode: () => {},
    }),
    [],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(AppThemeContext);
  if (!value) {
    throw new Error('useAppTheme must be used inside AppThemeProvider');
  }
  return value;
}
