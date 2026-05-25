import { StyleSheet, Text, View } from 'react-native';

import { fonts, spacing, useAppTheme } from '../theme';

type SectionHeaderProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  centered?: boolean;
};

export function SectionHeader({ centered = false, eyebrow, subtitle, title }: SectionHeaderProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.wrap, centered && styles.centered]}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text> : null}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  centered: {
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 40,
    lineHeight: 48,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
});
