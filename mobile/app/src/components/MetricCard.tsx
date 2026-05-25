import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, spacing, useAppTheme } from '../theme';
import { Card } from './Card';

type MetricCardProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
};

export function MetricCard({ icon, label, value }: MetricCardProps) {
  const { colors } = useAppTheme();

  return (
    <Card padding={spacing.md} style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
        <MaterialCommunityIcons color={colors.primary} name={icon} size={25} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
        <Text style={[styles.value, { color: colors.primary }]}>{value}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 86,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  copy: {
    flex: 1,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  value: {
    fontFamily: fonts.headingSemi,
    fontSize: 28,
    lineHeight: 34,
  },
});
