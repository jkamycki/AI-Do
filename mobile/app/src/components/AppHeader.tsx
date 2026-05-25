import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radii, shadow, spacing, useAppTheme } from '../theme';
import { AidoLogo } from './AidoLogo';

type AppHeaderProps = {
  onProfilePress?: () => void;
  onSearchPress?: () => void;
};

export function AppHeader({ onProfilePress, onSearchPress }: AppHeaderProps) {
  const { colors } = useAppTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.cardStrong }]}>
      <View style={[styles.header, { borderBottomColor: colors.primarySoft }]}>
        <AidoLogo compact />
        <View style={styles.actions}>
          <Pressable
            accessibilityLabel="Search"
            onPress={onSearchPress}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons color={colors.primary} name="search" size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel="Profile"
            onPress={onProfilePress}
            style={({ pressed }) => [
              styles.profileButton,
              {
                backgroundColor: colors.cardStrong,
                borderColor: colors.primarySoft,
                shadowColor: colors.shadow,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Ionicons color={colors.accent} name="person-outline" size={21} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    zIndex: 5,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: 2,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  profileButton: {
    ...shadow,
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
});
