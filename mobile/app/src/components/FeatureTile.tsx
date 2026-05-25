import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text } from 'react-native';

import { fonts, radii, shadow, spacing, useAppTheme } from '../theme';

type FeatureTileProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
};

export function FeatureTile({ icon, label, onPress }: FeatureTileProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          borderColor: colors.border,
          shadowColor: colors.shadow,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <LinearGradient colors={[colors.cardStrong, colors.card]} style={styles.fill}>
        <LinearGradient colors={[colors.primarySoft, colors.accentSoft]} style={styles.iconWrap}>
          <MaterialCommunityIcons color={colors.primary} name={icon} size={29} />
        </LinearGradient>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    ...shadow,
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    minWidth: '30%',
    overflow: 'hidden',
  },
  fill: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    padding: spacing.sm,
    width: '100%',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
