import { NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { enableScreens } from 'react-native-screens';

import { AidoLogo } from './src/components/AidoLogo';
import { RootNavigator } from './src/navigation/RootNavigator';
import { PlanningDataProvider } from './src/state/PlanningDataContext';
import { AppThemeProvider, useAppTheme } from './src/theme';

enableScreens();

function AppShell() {
  const { colors, mode } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <PlanningDataProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </PlanningDataProvider>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular: require('./assets/fonts/Inter_400Regular.ttf'),
    Inter_500Medium: require('./assets/fonts/Inter_500Medium.ttf'),
    Inter_600SemiBold: require('./assets/fonts/Inter_600SemiBold.ttf'),
    Inter_700Bold: require('./assets/fonts/Inter_700Bold.ttf'),
    PlayfairDisplay_600SemiBold: require('./assets/fonts/PlayfairDisplay_600SemiBold.ttf'),
    PlayfairDisplay_700Bold: require('./assets/fonts/PlayfairDisplay_700Bold.ttf'),
  });

  if (!fontsLoaded) {
    return <AidoLogo splash />;
  }

  return (
    <AppThemeProvider>
      <AppShell />
    </AppThemeProvider>
  );
}
