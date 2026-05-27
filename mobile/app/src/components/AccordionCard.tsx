import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, spacing, useAppTheme } from '../theme';
import { Card } from './Card';

type AccordionCardProps = {
  children: ReactNode;
  headerRight?: ReactNode;
  subtitle?: string;
  title: string;
};

export function AccordionCard({ children, headerRight, subtitle, title }: AccordionCardProps) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);

  function toggle() {
    if (Platform.OS !== 'android') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpen((current) => !current);
  }

  return (
    <Card padding={0} style={styles.card}>
      <Pressable accessibilityRole="button" onPress={toggle} style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
        </View>
        <View style={styles.right}>
          {headerRight}
          <Ionicons color={colors.primary} name={open ? 'chevron-up' : 'chevron-down'} size={22} />
        </View>
      </Pressable>
      {open ? <View style={[styles.body, { borderTopColor: colors.border }]}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  right: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  body: {
    borderTopWidth: 1,
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
});
