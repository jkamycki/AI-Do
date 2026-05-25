import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

export const palette = {
  cream: '#FFF8F5',
  ivory: '#FFFCF9',
  blush: '#F7DDE2',
  blushDeep: '#D2778A',
  rose: '#B76C78',
  wine: '#74434A',
  ink: '#4D3034',
  muted: '#8D6E73',
  gold: '#D4A373',
  goldSoft: '#F0D1A3',
  sage: '#8D946A',
  gray: '#B5A9A8',
  white: '#FFFFFF',
  black: '#1F1719',
};

const lightColors = {
  background: palette.cream,
  backgroundAlt: '#FDECEF',
  card: 'rgba(255, 255, 255, 0.92)',
  cardStrong: palette.white,
  text: palette.ink,
  muted: palette.muted,
  primary: palette.rose,
  primarySoft: palette.blush,
  accent: palette.gold,
  accentSoft: palette.goldSoft,
  success: palette.sage,
  danger: '#D78184',
  border: 'rgba(183, 108, 120, 0.2)',
  shadow: '#8D3D58',
};

const darkColors = {
  background: '#22171A',
  backgroundAlt: '#322126',
  card: 'rgba(54, 35, 40, 0.94)',
  cardStrong: '#3C272D',
  text: '#FFF4F0',
  muted: '#E6C7CB',
  primary: '#E49AAA',
  primarySoft: '#57313A',
  accent: '#E2B67E',
  accentSoft: '#5C442A',
  success: '#B6BE82',
  danger: '#F19999',
  border: 'rgba(247, 221, 226, 0.14)',
  shadow: '#000000',
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
  sm: 12,
  md: 18,
  lg: 24,
  xl: 34,
};

export const shadow = {
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.12,
  shadowRadius: 18,
  elevation: 6,
};

type AppThemeContextValue = {
  mode: ThemeMode;
  colors: typeof lightColors;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');

  const value = useMemo<AppThemeContextValue>(
    () => ({
      mode,
      colors: mode === 'light' ? lightColors : darkColors,
      setMode,
      toggleMode: () => setMode((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [mode],
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
