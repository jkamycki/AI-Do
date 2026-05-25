import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { fonts, radii, spacing, useAppTheme } from '../theme';

type PrimaryButtonProps = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'gold';
};

export function PrimaryButton({ icon, label, onPress, variant = 'primary' }: PrimaryButtonProps) {
  const { colors } = useAppTheme();
  const backgroundColor = variant === 'primary' ? colors.primary : variant === 'gold' ? colors.accent : colors.cardStrong;
  const borderColor = variant === 'ghost' ? colors.border : backgroundColor;
  const color = variant === 'ghost' ? colors.text : colors.cardStrong;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor,
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      {icon ? <Ionicons color={color} name={icon} size={18} /> : null}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
});
