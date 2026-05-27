import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { radii, shadow, spacing, useAppTheme } from '../theme';

type CardProps = {
  children: ReactNode;
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, padding = spacing.lg, style }: CardProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.cardStrong,
          borderColor: colors.border,
          padding,
          shadowColor: colors.shadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadow,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
});
