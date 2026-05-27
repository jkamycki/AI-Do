import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useAppTheme } from '../theme';

type ScreenProps = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function Screen({ children, contentStyle, onRefresh, refreshing = false }: ScreenProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={[colors.background, colors.backgroundAlt, colors.background]} style={styles.root}>
      <SafeAreaView edges={['left', 'right']} style={styles.safe}>
        <ScrollView
          alwaysBounceVertical
          contentContainerStyle={[styles.content, contentStyle, { paddingBottom: 168 + insets.bottom }]}
          contentInsetAdjustmentBehavior="never"
          fadingEdgeLength={24}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          overScrollMode="always"
          persistentScrollbar
          refreshControl={onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator
          style={styles.scroll}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
});
