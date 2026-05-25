import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';
import { SeatingTable } from '../types';

const seatPositions = [
  { left: 82, top: 8 },
  { left: 134, top: 29 },
  { left: 152, top: 82 },
  { left: 132, top: 134 },
  { left: 82, top: 152 },
  { left: 30, top: 134 },
  { left: 10, top: 82 },
  { left: 30, top: 30 },
];

export function SeatingChartScreen() {
  const { colors } = useAppTheme();
  const { data, respondAsAria } = usePlanningData();
  const assigned = data.seating.reduce((sum, table) => sum + table.assigned, 0);
  const capacity = data.seating.reduce((sum, table) => sum + table.capacity, 0);

  return (
    <Screen>
      <SectionHeader subtitle="Visualize tables, seats, capacity, and guest assignments before exporting your seating plan." title="Seating Chart" />

      <View style={styles.metricRow}>
        <MetricCard icon="table-chair" label="Assigned" value={`${assigned}/${capacity}`} />
        <MetricCard icon="account-group-outline" label="Tables" value={data.seating.length.toString()} />
      </View>

      <Card style={styles.aiCard}>
        <MaterialCommunityIcons color={colors.accent} name="auto-fix" size={28} />
        <View style={styles.aiCopy}>
          <Text style={[styles.aiTitle, { color: colors.text }]}>AI Seating Preview</Text>
          <Text style={[styles.aiText, { color: colors.muted }]}>
            Generate a draft, preview each table, then adjust guests in the list before applying it back to your guest records.
          </Text>
        </View>
        <PrimaryButton icon="sparkles-outline" label="Generate" onPress={() => respondAsAria('Generate seating suggestions from the guest list')} />
      </Card>

      {data.seating.map((table) => {
        const progress = table.capacity ? (table.assigned / table.capacity) * 100 : 0;
        const guests = data.guests.filter((guest) => guest.table.toLowerCase().includes(table.name.toLowerCase())).map((guest) => guest.name);
        return (
          <Card key={table.id} style={styles.tableCard}>
            <View style={styles.tableHeader}>
              <View style={[styles.tableIcon, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.tableLetter, { color: colors.primary }]}>{table.name.replace('Table ', '')}</Text>
              </View>
              <View style={styles.tableCopy}>
                <Text style={[styles.tableName, { color: colors.text }]}>{table.name}</Text>
                <Text style={[styles.tableMeta, { color: colors.muted }]}>{table.assigned} seated - {table.capacity - table.assigned} open</Text>
              </View>
            </View>

            <View style={styles.previewRow}>
              <TablePreview guests={guests} table={table} />
              <View style={styles.previewList}>
                <Text style={[styles.previewTitle, { color: colors.text }]}>Seat List</Text>
                {Array.from({ length: table.capacity }).slice(0, 8).map((_, seatIndex) => (
                  <Text key={seatIndex} style={[styles.seatName, { color: colors.muted }]}>
                    {seatIndex + 1}. {guests[seatIndex] ?? 'Open seat'}
                  </Text>
                ))}
              </View>
            </View>

            <ProgressBar value={progress} />
            <Text style={[styles.notes, { color: colors.muted }]}>{table.notes}</Text>
            <View style={styles.actions}>
              <PrimaryButton icon="create-outline" label="Adjust" variant="ghost" />
              <PrimaryButton icon="checkmark-outline" label="Apply Plan" />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

function TablePreview({ guests, table }: { guests: string[]; table: SeatingTable }) {
  const { colors } = useAppTheme();
  const seatCount = Math.min(table.capacity, 8);

  return (
    <View style={[styles.previewShell, { backgroundColor: colors.cardStrong, borderColor: colors.border }]}>
      <View style={[styles.roundTable, { borderColor: colors.accent, backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.roundTableText, { color: colors.text }]}>{table.name.replace('Table ', '')}</Text>
      </View>
      {Array.from({ length: seatCount }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.seat,
            {
              backgroundColor: guests[index] ? colors.primary : colors.cardStrong,
              borderColor: guests[index] ? colors.primary : colors.border,
              left: seatPositions[index].left,
              top: seatPositions[index].top,
            },
          ]}
        >
          <Text style={[styles.seatNumber, { color: guests[index] ? colors.cardStrong : colors.muted }]}>{index + 1}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  aiCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  aiCopy: {
    flex: 1,
  },
  aiText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  aiTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 22,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  notes: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  previewList: {
    flex: 1,
  },
  previewRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  previewShell: {
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 190,
    position: 'relative',
    width: 190,
  },
  previewTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  roundTable: {
    alignItems: 'center',
    borderRadius: 46,
    borderWidth: 2,
    height: 92,
    justifyContent: 'center',
    left: 49,
    position: 'absolute',
    top: 49,
    width: 92,
  },
  roundTableText: {
    fontFamily: fonts.headingSemi,
    fontSize: 28,
  },
  seat: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    width: 30,
  },
  seatName: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  seatNumber: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  tableCard: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  tableCopy: {
    flex: 1,
  },
  tableHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  tableIcon: {
    alignItems: 'center',
    borderRadius: radii.lg,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  tableLetter: {
    fontFamily: fonts.headingSemi,
    fontSize: 25,
  },
  tableMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  tableName: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
  },
});
