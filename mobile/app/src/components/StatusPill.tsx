import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, radii, spacing, useAppTheme } from '../theme';
import { RsvpStatus, VendorStatus } from '../types';

type StatusPillProps = {
  status: VendorStatus | RsvpStatus | 'On Track' | 'Over Budget';
};

export function StatusPill({ status }: StatusPillProps) {
  const { colors } = useAppTheme();
  const kind = getKind(status);
  const backgroundColor =
    kind === 'success' ? colors.success : kind === 'warning' ? colors.accentSoft : kind === 'danger' ? colors.danger : colors.primarySoft;
  const color = kind === 'success' || kind === 'danger' ? colors.cardStrong : colors.text;
  const icon = kind === 'success' ? 'checkmark' : kind === 'danger' ? 'close' : 'time-outline';

  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <Ionicons color={color} name={icon} size={14} />
      <Text style={[styles.text, { color }]}>{status}</Text>
    </View>
  );
}

function getKind(status: StatusPillProps['status']) {
  if (status === 'Paid' || status === 'Completed' || status === 'Signed' || status === 'Confirmed' || status === 'On Track') {
    return 'success';
  }
  if (status === 'Declined' || status === 'Over Budget') {
    return 'danger';
  }
  if (status === 'Pending' || status === 'Ongoing' || status === 'Due Soon') {
    return 'warning';
  }
  return 'neutral';
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.xl,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
});
