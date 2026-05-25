import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { InvitationThumb } from '../components/InvitationThumb';
import { MetricCard } from '../components/MetricCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, spacing, useAppTheme } from '../theme';

export function InvitationsScreen() {
  const { colors } = useAppTheme();
  const { data, updateInvitationStatus } = usePlanningData();
  const sent = data.invitations.reduce((sum, item) => sum + item.sent, 0);
  const responses = data.invitations.reduce((sum, item) => sum + item.responses, 0);

  return (
    <Screen>
      <SectionHeader subtitle="Save-the-dates, digital invitation, RSVP pages, reminder sending, and delivery tracking." title="Invitations" />

      <View style={styles.metricRow}>
        <MetricCard icon="send-check-outline" label="Sent" value={sent.toString()} />
        <MetricCard icon="email-check-outline" label="Responses" value={responses.toString()} />
      </View>

      {data.invitations.map((suite, index) => {
        const openRate = suite.sent ? Math.round((suite.opened / suite.sent) * 100) : 0;
        return (
          <Card key={suite.id} style={styles.inviteCard}>
            <InvitationThumb styleName={index === 0 ? 'floral' : index === 1 ? 'cream' : 'brown'} />
            <View style={styles.copy}>
              <View style={styles.header}>
                <View>
                  <Text style={[styles.title, { color: colors.text }]}>{suite.type}</Text>
                  <Text style={[styles.meta, { color: colors.muted }]}>{suite.status} - {suite.opened} opened</Text>
                </View>
                <Ionicons color={colors.accent} name="chevron-forward" size={21} />
              </View>
              <ProgressBar value={openRate} />
              <View style={styles.stats}>
                <Text style={[styles.stat, { color: colors.muted }]}>Open rate {openRate}%</Text>
                <Text style={[styles.stat, { color: colors.muted }]}>{suite.responses} responses</Text>
              </View>
              <View style={styles.actions}>
                <PrimaryButton icon="eye-outline" label="Preview" variant="ghost" />
                <PrimaryButton
                  icon="send-outline"
                  label={suite.status === 'Sent' ? 'Reminder' : 'Send'}
                  onPress={() => updateInvitationStatus(suite.id, 'Sent')}
                />
                <PrimaryButton icon="calendar-outline" label="Schedule" onPress={() => updateInvitationStatus(suite.id, 'Scheduled')} variant="ghost" />
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  inviteCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.sm,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
