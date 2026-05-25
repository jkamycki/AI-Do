import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { FilterPill } from '../components/FilterPill';
import { MetricCard } from '../components/MetricCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';
import { DayOfChecklistItem } from '../types';

type DayOfTab = 'Timeline' | DayOfChecklistItem['category'];

const dayOfTabs: DayOfTab[] = ['Timeline', 'Ceremony', 'Music', 'Speeches', 'Setup', 'Attire', 'Vendors', 'Packing'];

export function DayOfScreen() {
  const { colors } = useAppTheme();
  const { data, respondAsAria, toggleDayOfChecklistItem, toggleDayOfEvent } = usePlanningData();
  const [activeTab, setActiveTab] = useState<DayOfTab>('Timeline');
  const complete = data.dayOf.filter((item) => item.completed).length;
  const checklistComplete = data.dayOfChecklist.filter((item) => item.completed).length;
  const checklistItems = data.dayOfChecklist.filter((item) => item.category === activeTab);

  return (
    <Screen>
      <SectionHeader subtitle="A clean wedding-day command center for the timeline, owners, packing, music, setup, and vendor handoffs." title="Day Of" />

      <View style={styles.metricRow}>
        <MetricCard icon="calendar-clock" label="Events" value={data.dayOf.length.toString()} />
        <MetricCard icon="check-decagram-outline" label="Complete" value={`${complete}/${data.dayOf.length}`} />
      </View>

      <Card style={styles.emergencyCard}>
        <View style={[styles.emergencyIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name="call-outline" size={26} />
        </View>
        <View style={styles.emergencyCopy}>
          <Text style={[styles.emergencyTitle, { color: colors.text }]}>Coordinator Binder</Text>
          <Text style={[styles.emergencyText, { color: colors.muted }]}>
            {checklistComplete} of {data.dayOfChecklist.length} checklist items complete. Keep this ready for your planner, venue, and wedding party.
          </Text>
        </View>
      </Card>

      <Card style={styles.binderCard}>
        <Text style={[styles.binderTitle, { color: colors.text }]}>Export and Regenerate</Text>
        <Text style={[styles.binderText, { color: colors.muted }]}>Regenerate when ceremony time, photo flow, venue access, or vendor timing changes.</Text>
        <View style={styles.binderActions}>
          <PrimaryButton icon="sparkles-outline" label="Ask Aria" onPress={() => respondAsAria('Regenerate my day-of coordinator binder')} variant="gold" />
          <PrimaryButton icon="document-text-outline" label="PDF" variant="ghost" />
          <PrimaryButton icon="albums-outline" label="Full Binder" />
        </View>
      </Card>

      <View style={styles.tabs}>
        {dayOfTabs.map((tab) => (
          <FilterPill active={activeTab === tab} key={tab} label={tab} onPress={() => setActiveTab(tab)} />
        ))}
      </View>

      {activeTab === 'Timeline'
        ? data.dayOf.map((event, index) => (
            <View key={event.id} style={styles.timelineRow}>
              <View style={styles.rail}>
                <View style={[styles.dot, { backgroundColor: event.completed ? colors.success : colors.primary }]} />
                {index < data.dayOf.length - 1 ? <View style={[styles.line, { backgroundColor: colors.border }]} /> : null}
              </View>
              <Pressable onPress={() => toggleDayOfEvent(event.id)} style={({ pressed }) => [styles.eventPress, { opacity: pressed ? 0.78 : 1 }]}>
                <Card style={styles.eventCard}>
                  <View style={styles.eventHeader}>
                    <Text style={[styles.eventTime, { color: colors.primary }]}>{event.time}</Text>
                    <Ionicons color={event.completed ? colors.success : colors.accent} name={event.completed ? 'checkmark-circle' : 'time-outline'} size={23} />
                  </View>
                  <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
                  <Text style={[styles.eventMeta, { color: colors.muted }]}>
                    {event.owner} - {event.location}
                  </Text>
                </Card>
              </Pressable>
            </View>
          ))
        : checklistItems.map((item) => (
            <Pressable key={item.id} onPress={() => toggleDayOfChecklistItem(item.id)} style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
              <Card style={styles.checklistCard}>
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: item.completed ? colors.success : colors.cardStrong,
                      borderColor: item.completed ? colors.success : colors.border,
                    },
                  ]}
                >
                  {item.completed ? <Ionicons color={colors.cardStrong} name="checkmark" size={18} /> : null}
                </View>
                <View style={styles.checklistCopy}>
                  <Text style={[styles.checklistTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.checklistNote, { color: colors.muted }]}>{item.note}</Text>
                </View>
              </Card>
            </Pressable>
          ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  binderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  binderCard: {
    marginBottom: spacing.lg,
  },
  binderText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 2,
  },
  binderTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 23,
  },
  checkbox: {
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 2,
    height: 28,
    justifyContent: 'center',
    marginTop: 2,
    width: 28,
  },
  checklistCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  checklistCopy: {
    flex: 1,
  },
  checklistNote: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  checklistTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
  },
  dot: {
    borderRadius: 9,
    height: 18,
    marginTop: 25,
    width: 18,
  },
  emergencyCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  emergencyCopy: {
    flex: 1,
  },
  emergencyIcon: {
    alignItems: 'center',
    borderRadius: radii.lg,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  emergencyText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  emergencyTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 22,
  },
  eventCard: {
    marginBottom: spacing.md,
  },
  eventHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  eventPress: {
    flex: 1,
  },
  eventTime: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  eventTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 23,
    marginTop: spacing.xs,
  },
  line: {
    flex: 1,
    marginTop: spacing.xs,
    width: 2,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  rail: {
    alignItems: 'center',
    width: 22,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
