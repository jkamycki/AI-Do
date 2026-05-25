import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { radii, shadow, spacing, useAppTheme } from '../theme';

type CardProps = {
  children: ReactNode;
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, padding = spacing.lg, style }: CardProps) {
  const { colors } = useAppTheme();

  return (
    <LinearGradient
      colors={[colors.cardStrong, colors.card]}
      style={[
        styles.card,
        {
          borderColor: colors.border,
          padding,
          shadowColor: colors.shadow,
        },
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadow,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
});
