import { StyleSheet, View } from 'react-native';

import { radii, useAppTheme } from '../theme';

type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
  const { colors } = useAppTheme();
  const width = `${Math.max(0, Math.min(100, value))}%` as `${number}%`;

  return (
    <View style={[styles.track, { backgroundColor: colors.primarySoft }]}>
      <View style={[styles.fill, { backgroundColor: colors.primary, width }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radii.xl,
    height: 10,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: radii.xl,
    height: '100%',
  },
});
