import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, useAppTheme } from '../theme';

type ScreenProps = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function Screen({ children, contentStyle, onRefresh, refreshing = false }: ScreenProps) {
  const { colors } = useAppTheme();

  return (
    <LinearGradient colors={[colors.background, colors.backgroundAlt, colors.background]} style={styles.root}>
      <View pointerEvents="none" style={styles.patternTop}>
        <View style={[styles.petal, styles.petalOne, { backgroundColor: colors.primarySoft }]} />
        <View style={[styles.petal, styles.petalTwo, { backgroundColor: colors.accentSoft }]} />
        <View style={[styles.petal, styles.petalThree, { backgroundColor: colors.primarySoft }]} />
      </View>
      <View pointerEvents="none" style={styles.patternBottom}>
        <View style={[styles.stem, { backgroundColor: colors.accent }]} />
        <View style={[styles.smallPetal, styles.smallPetalOne, { backgroundColor: colors.primarySoft }]} />
        <View style={[styles.smallPetal, styles.smallPetalTwo, { backgroundColor: colors.primarySoft }]} />
      </View>
      <SafeAreaView edges={['left', 'right']} style={styles.safe}>
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          overScrollMode="always"
          refreshControl={onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
          showsVerticalScrollIndicator={false}
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
    paddingBottom: 176,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  patternTop: {
    height: 150,
    opacity: 0.28,
    position: 'absolute',
    right: -44,
    top: 58,
    width: 150,
  },
  petal: {
    borderRadius: 999,
    height: 66,
    position: 'absolute',
    width: 34,
  },
  petalOne: {
    right: 56,
    top: 8,
    transform: [{ rotate: '-34deg' }],
  },
  petalTwo: {
    right: 82,
    top: 38,
    transform: [{ rotate: '22deg' }],
  },
  petalThree: {
    right: 30,
    top: 46,
    transform: [{ rotate: '-58deg' }],
  },
  patternBottom: {
    bottom: 160,
    height: 82,
    left: -28,
    opacity: 0.22,
    position: 'absolute',
    width: 150,
  },
  stem: {
    height: 2,
    left: 26,
    position: 'absolute',
    top: 44,
    width: 102,
  },
  smallPetal: {
    borderRadius: 999,
    height: 48,
    position: 'absolute',
    top: 22,
    width: 25,
  },
  smallPetalOne: {
    left: 34,
    transform: [{ rotate: '38deg' }],
  },
  smallPetalTwo: {
    left: 62,
    transform: [{ rotate: '-34deg' }],
  },
});
