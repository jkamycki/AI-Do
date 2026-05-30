import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { InvitationThumb } from '../components/InvitationThumb';
import { MetricCard } from '../components/MetricCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { sendPendingRsvpReminders, sendRsvpInvitations, sendSaveTheDates, type GuestCampaign } from '../api/guestMessaging';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, spacing, useAppTheme } from '../theme';
import { InvitationSuite } from '../types';

type SendLink = { emailSent: boolean; guestId: number; name: string; url: string };

export function InvitationsScreen() {
  const { colors } = useAppTheme();
  const { data, updateInvitationStatus } = usePlanningData();
  const [sending, setSending] = useState<GuestCampaign | null>(null);
  const [sendMessage, setSendMessage] = useState('');
  const [manualLinks, setManualLinks] = useState<SendLink[]>([]);
  const sent = data.invitations.reduce((sum, item) => sum + item.sent, 0);
  const responses = data.invitations.reduce((sum, item) => sum + item.responses, 0);

  async function sendSuite(suite: InvitationSuite) {
    const campaign = campaignForSuite(suite);
    const sender = campaign === 'save-the-dates'
      ? sendSaveTheDates
      : campaign === 'rsvp-invites'
        ? sendRsvpInvitations
        : sendPendingRsvpReminders;

    setSending(campaign);
    setSendMessage('');
    setManualLinks([]);

    try {
      const result = await sender();
      updateInvitationStatus(suite.id, 'Sent');
      setManualLinks(result.links.filter((link) => !link.emailSent));
      if (!result.attempted) {
        setSendMessage(`No eligible guests for ${campaignLabel(campaign).toLowerCase()} right now.`);
      } else {
        setSendMessage(
          `${campaignLabel(campaign)} sent to ${result.delivered} guests. ${result.markedSent} guest${result.markedSent === 1 ? '' : 's'} had no email and were marked with a share link.`,
        );
      }
    } catch (error) {
      setSendMessage(error instanceof Error ? error.message : 'Could not send from the app.');
    } finally {
      setSending(null);
    }
  }

  function previewSuite(suite: InvitationSuite) {
    setSendMessage(`${suite.type} preview is ready. Use the send button when you want to message guests.`);
  }

  async function shareGuestLink(link: SendLink) {
    await Share.share({
      message: `${link.name}, here is your A.I DO wedding link: ${link.url}`,
      url: link.url,
    });
  }

  return (
    <Screen>
      <SectionHeader subtitle="Save-the-dates, digital invitation, RSVP pages, reminder sending, and delivery tracking." title="Invitations" />

      <View style={styles.metricRow}>
        <MetricCard icon="send-check-outline" label="Sent" value={sent.toString()} />
        <MetricCard icon="email-check-outline" label="Responses" value={responses.toString()} />
      </View>

      {sendMessage ? (
        <Card style={styles.noticeCard}>
          <Text style={[styles.noticeTitle, { color: colors.text }]}>Send update</Text>
          <Text style={[styles.noticeText, { color: colors.muted }]}>{sendMessage}</Text>
          {manualLinks.length ? (
            <View style={styles.manualLinks}>
              {manualLinks.slice(0, 5).map((link) => (
                <View key={`${link.guestId}-${link.url}`} style={[styles.manualLinkRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.manualLinkName, { color: colors.text }]}>{link.name}</Text>
                  <PrimaryButton icon="share-outline" label="Share Link" onPress={() => void shareGuestLink(link)} variant="ghost" />
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {data.invitations.map((suite, index) => {
        const openRate = suite.sent ? Math.round((suite.opened / suite.sent) * 100) : 0;
        const campaign = campaignForSuite(suite);
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
                <PrimaryButton icon="eye-outline" label="Preview" onPress={() => previewSuite(suite)} variant="ghost" />
                <PrimaryButton
                  icon="send-outline"
                  label={sending === campaign ? 'Sending...' : suite.type === 'RSVP' ? 'Send Reminders' : 'Send'}
                  onPress={() => void sendSuite(suite)}
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

function campaignForSuite(suite: InvitationSuite): GuestCampaign {
  if (suite.type === 'Save the Date') return 'save-the-dates';
  if (suite.type === 'RSVP') return 'rsvp-reminders';
  return 'rsvp-invites';
}

function campaignLabel(campaign: GuestCampaign) {
  if (campaign === 'save-the-dates') return 'Save the Dates';
  if (campaign === 'rsvp-invites') return 'RSVP Invites';
  return 'RSVP Reminders';
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeCard: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  noticeTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 20,
  },
  noticeText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  manualLinks: {
    marginTop: spacing.sm,
  },
  manualLinkRow: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  manualLinkName: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 13,
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
