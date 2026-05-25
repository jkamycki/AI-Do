import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';

const timeline = [
  { time: '12 months', title: 'Book venue and key vendors', detail: 'Venue, planner, photographer, entertainment, and florals.' },
  { time: '8 months', title: 'Send save-the-dates', detail: 'Finalize guest list, mailing addresses, and invitation style.' },
  { time: '4 months', title: 'Design final details', detail: 'Menu, rentals, stationery, ceremony flow, and beauty trials.' },
  { time: '1 month', title: 'Confirm every handoff', detail: 'Final counts, vendor balances, timeline PDF, and emergency kit.' },
];

export function TimelineScreen() {
  const { colors } = useAppTheme();
  const { respondAsAria } = usePlanningData();

  return (
    <Screen>
      <SectionHeader subtitle="A clear planning path from big decisions to final details." title="Timeline" />

      <Card style={styles.commandCard}>
        <View style={styles.commandCopy}>
          <Text style={[styles.commandTitle, { color: colors.text }]}>AI Timeline Builder</Text>
          <Text style={[styles.commandMeta, { color: colors.muted }]}>Create master, guest, and vendor timelines, then export the final plan.</Text>
        </View>
        <PrimaryButton icon="sparkles-outline" label="Generate" onPress={() => respondAsAria('Build my wedding planning timeline')} />
      </Card>

      {timeline.map((item, index) => (
        <View key={item.time} style={styles.timelineRow}>
          <View style={styles.rail}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            {index < timeline.length - 1 ? <View style={[styles.line, { backgroundColor: colors.border }]} /> : null}
          </View>
          <Card style={styles.timelineCard}>
            <View style={styles.timeRow}>
              <Text style={[styles.time, { color: colors.primary }]}>{item.time}</Text>
              <Ionicons color={colors.accent} name="calendar-outline" size={20} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.detail, { color: colors.muted }]}>{item.detail}</Text>
          </Card>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  commandCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  commandCopy: {
    flex: 1,
  },
  commandTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 22,
  },
  commandMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rail: {
    alignItems: 'center',
    width: 22,
  },
  dot: {
    borderRadius: radii.sm,
    height: 16,
    marginTop: 24,
    width: 16,
  },
  line: {
    flex: 1,
    marginTop: spacing.xs,
    width: 2,
  },
  timelineCard: {
    flex: 1,
    marginBottom: spacing.md,
  },
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.headingSemi,
    fontSize: 23,
    marginTop: spacing.xs,
  },
  detail: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
});
