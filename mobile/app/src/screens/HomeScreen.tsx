import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { StatusPill } from '../components/StatusPill';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';
import { daysFromToday, daysUntil, formatCurrency, formatDeadlineLabel, formatShortDate } from '../utils/format';

type RouteName =
  | 'Aria'
  | 'Budget'
  | 'Checklist'
  | 'Contracts'
  | 'DayOf'
  | 'Files'
  | 'GuestPhotoDrop'
  | 'Guests'
  | 'Hotels'
  | 'Invitations'
  | 'MoodBoard'
  | 'More'
  | 'ProfileSettings'
  | 'SeatingChart'
  | 'Settings'
  | 'Timeline'
  | 'Vendors'
  | 'WebsiteEditor'
  | 'WeddingParty'
  | 'Workspace';

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { data, loading, refresh } = usePlanningData();
  const { profile } = data;
  const totalBudget = data.budget.reduce((sum, item) => sum + item.total, 0);
  const totalPaid = data.budget.reduce((sum, item) => sum + item.paid, 0);
  const taskProgress = data.tasks.length ? Math.round((data.tasks.filter((task) => task.completed).length / data.tasks.length) * 100) : 0;
  const confirmedGuests = data.guests.filter((guest) => guest.rsvp === 'Confirmed').length;
  const pendingGuests = data.guests.filter((guest) => guest.rsvp === 'Pending').length;
  const reviewContracts = data.contracts.filter((contract) => contract.status !== 'Signed').length;
  const dueTasks = data.tasks
    .filter((task) => !task.completed)
    .sort((a, b) => (daysFromToday(a.dueDate) ?? 9999) - (daysFromToday(b.dueDate) ?? 9999))
    .slice(0, 3);
  const websiteDrafts = data.websiteSections.filter((section) => section.status !== 'Published').length;
  const nextPayment = data.budget
    .filter((item) => item.nextPayment)
    .sort((a, b) => String(a.nextPayment?.date).localeCompare(String(b.nextPayment?.date)))[0];

  const go = (route: RouteName) => navigation.navigate(route);

  return (
    <Screen contentStyle={styles.homeContent} onRefresh={refresh} refreshing={loading}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>A.I Do Planner</Text>
            <Text style={[styles.couple, { color: colors.text }]}>{profile.coupleName}</Text>
            <Text style={[styles.date, { color: colors.muted }]}>
              {formatShortDate(profile.weddingDate)} at {profile.venue}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Open profile"
            onPress={() => go('ProfileSettings')}
            style={({ pressed }) => [
              styles.avatar,
              { backgroundColor: colors.primarySoft, borderColor: colors.cardStrong, opacity: pressed ? 0.78 : 1 },
            ]}
          >
            <Text style={[styles.avatarText, { color: colors.primary }]}>{profile.photoInitials}</Text>
          </Pressable>
        </View>

        <View style={styles.heroMetrics}>
          <Metric label="Days" value={String(daysUntil(profile.weddingDate))} />
          <Metric label="Planned" value={`${taskProgress}%`} />
          <Metric label="Guests" value={`${confirmedGuests}/${profile.guestTarget}`} />
        </View>
      </View>

      <Pressable onPress={() => go('Aria')} style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
        <Card padding={spacing.md} style={styles.ariaCard}>
          <View style={[styles.ariaIcon, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons color={colors.cardStrong} name="star-four-points" size={22} />
          </View>
          <View style={styles.ariaCopy}>
            <Text style={[styles.cardEyebrow, { color: colors.primary }]}>Next best move</Text>
            <Text style={[styles.ariaText, { color: colors.text }]}>
              Review {reviewContracts} contracts, nudge {pendingGuests} guests, and finish {websiteDrafts} website sections.
            </Text>
          </View>
          <Ionicons color={colors.muted} name="chevron-forward" size={20} />
        </Card>
      </Pressable>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today</Text>
          <Text style={[styles.sectionMeta, { color: colors.muted }]}>Clear, short, and actionable.</Text>
        </View>
        <Pressable onPress={() => go('Checklist')}>
          <Text style={[styles.link, { color: colors.primary }]}>Checklist</Text>
        </Pressable>
      </View>

      {dueTasks.map((task) => (
        <Pressable key={task.id} onPress={() => go('Checklist')} style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
          <Card padding={spacing.md} style={styles.taskCard}>
            <View style={[styles.taskMark, { backgroundColor: colors.primarySoft }]}>
              <Ionicons color={colors.primary} name="checkmark-circle-outline" size={20} />
            </View>
            <View style={styles.taskCopy}>
              <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title}</Text>
              <Text style={[styles.taskMeta, { color: colors.muted }]}>
                {task.category} - {formatDeadlineLabel(task.dueDate)}
              </Text>
            </View>
          </Card>
        </Pressable>
      ))}

      <Card style={styles.pulseCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Planner Pulse</Text>
            <Text style={[styles.sectionMeta, { color: colors.muted }]}>Health of the major website workflows.</Text>
          </View>
          <StatusPill status={taskProgress >= 60 ? 'On Track' : 'Pending'} />
        </View>
        <ProgressBar value={taskProgress} />
        <View style={styles.pulseGrid}>
          <PulseItem icon="wallet-outline" label="Paid" value={formatCurrency(totalPaid)} />
          <PulseItem icon="cash-outline" label="Budget" value={formatCurrency(totalBudget)} />
          <PulseItem icon="document-text-outline" label="Files" value={String(data.documents.length)} />
        </View>
      </Card>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Feature Shortcuts</Text>
          <Text style={[styles.sectionMeta, { color: colors.muted }]}>The full website, simplified for phone use.</Text>
        </View>
        <Pressable onPress={() => go('More')}>
          <Text style={[styles.link, { color: colors.primary }]}>All</Text>
        </Pressable>
      </View>

      <View style={styles.shortcutGrid}>
        <Shortcut icon="globe-outline" label="Website" meta={`${websiteDrafts} drafts`} onPress={() => go('WebsiteEditor')} />
        <Shortcut icon="mail-open-outline" label="Invites" meta={`${data.invitations.length} suites`} onPress={() => go('Invitations')} />
        <Shortcut icon="storefront-outline" label="Vendors" meta={`${data.vendors.length} booked`} onPress={() => go('Vendors')} />
        <Shortcut icon="grid-outline" label="Seating" meta={`${data.seating.length} tables`} onPress={() => go('SeatingChart')} />
        <Shortcut icon="camera-outline" label="Photo Drop" meta={data.guestPhotoDrop.enabled ? 'Live' : 'Off'} onPress={() => go('GuestPhotoDrop')} />
        <Shortcut icon="people-outline" label="Workspace" meta={`${data.workspaceInvites.length} invites`} onPress={() => go('Workspace')} />
      </View>

      <Card style={styles.paymentCard}>
        <View style={styles.cardHeader}>
          <View style={styles.paymentCopy}>
            <Text style={[styles.cardEyebrow, { color: colors.primary }]}>Next payment</Text>
            <Text style={[styles.paymentTitle, { color: colors.text }]}>{nextPayment?.title ?? 'No payment due'}</Text>
            <Text style={[styles.paymentMeta, { color: colors.muted }]}>
              {nextPayment?.nextPayment
                ? `${formatCurrency(nextPayment.nextPayment.amount)} due ${formatShortDate(nextPayment.nextPayment.date)}`
                : 'Everything looks current.'}
            </Text>
          </View>
          <Pressable onPress={() => go('Budget')} style={[styles.smallButton, { backgroundColor: colors.primary }]}>
            <Ionicons color={colors.cardStrong} name="arrow-forward" size={18} />
          </Pressable>
        </View>
      </Card>
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.metric, { backgroundColor: colors.cardStrong, borderColor: colors.border }]}>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function PulseItem({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.pulseItem}>
      <Ionicons color={colors.primary} name={icon} size={18} />
      <Text style={[styles.pulseValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.pulseLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function Shortcut({ icon, label, meta, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; meta: string; onPress: () => void }) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.shortcut,
        { backgroundColor: colors.cardStrong, borderColor: colors.border, opacity: pressed ? 0.76 : 1, shadowColor: colors.shadow },
      ]}
    >
      <View style={[styles.shortcutIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons color={colors.primary} name={icon} size={20} />
      </View>
      <Text numberOfLines={1} style={[styles.shortcutLabel, { color: colors.text }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.shortcutMeta, { color: colors.muted }]}>{meta}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  homeContent: {
    paddingBottom: 188,
  },
  ariaCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  ariaCopy: {
    flex: 1,
  },
  ariaIcon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  ariaText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 2,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 26,
    borderWidth: 3,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  cardEyebrow: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  couple: {
    fontFamily: fonts.heading,
    fontSize: 34,
    lineHeight: 38,
  },
  date: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  hero: {
    marginBottom: spacing.lg,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroMetrics: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  link: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  metric: {
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  metricLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
    lineHeight: 28,
  },
  paymentCard: {
    marginTop: spacing.lg,
  },
  paymentCopy: {
    flex: 1,
  },
  paymentMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  paymentTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 22,
    marginTop: 2,
  },
  pulseCard: {
    marginBottom: spacing.xl,
  },
  pulseGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  pulseItem: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  pulseLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  pulseValue: {
    fontFamily: fonts.headingSemi,
    fontSize: 17,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
  },
  shortcut: {
    borderRadius: radii.lg,
    borderWidth: 1,
    elevation: 2,
    flexBasis: '47.8%',
    minHeight: 112,
    padding: spacing.md,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  shortcutIcon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 38,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: 38,
  },
  shortcutLabel: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  shortcutMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  smallButton: {
    alignItems: 'center',
    borderRadius: radii.xl,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  taskCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  taskCopy: {
    flex: 1,
  },
  taskMark: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  taskMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  taskTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
});
