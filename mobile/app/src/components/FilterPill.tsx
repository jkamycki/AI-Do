import { Pressable, StyleSheet, Text } from 'react-native';

import { fonts, radii, spacing, useAppTheme } from '../theme';

type FilterPillProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

export function FilterPill({ active, label, onPress }: FilterPillProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: active ? colors.primary : colors.cardStrong,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: active ? colors.cardStrong : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
});
