import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { FeatureTile } from '../components/FeatureTile';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { StatusPill } from '../components/StatusPill';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';
import { daysUntil, formatCurrency, formatShortDate } from '../utils/format';

type RouteName =
  | 'Aria'
  | 'Budget'
  | 'Checklist'
  | 'Contracts'
  | 'DayOf'
  | 'Files'
  | 'GuestPhotoDrop'
  | 'Guests'
  | 'Invitations'
  | 'MoodBoard'
  | 'ProfileSettings'
  | 'Timeline'
  | 'Vendors'
  | 'WebsiteEditor';

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
  const unsignedContracts = data.contracts.filter((contract) => contract.status !== 'Signed').length;
  const dueTasks = data.tasks.filter((task) => !task.completed).slice(0, 3);
  const nextPayment = data.budget
    .filter((item) => item.nextPayment)
    .sort((a, b) => String(a.nextPayment?.date).localeCompare(String(b.nextPayment?.date)))[0];

  const go = (route: RouteName) => navigation.navigate(route);

  return (
    <Screen contentStyle={styles.homeContent} onRefresh={refresh} refreshing={loading}>
      <Card padding={spacing.lg} style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={[styles.avatar, { backgroundColor: colors.primarySoft, borderColor: colors.cardStrong }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{profile.photoInitials}</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.greeting, { color: colors.muted }]}>A.I Do Command Center</Text>
            <Text style={[styles.couple, { color: colors.text }]}>{profile.coupleName}</Text>
            <Text style={[styles.date, { color: colors.muted }]}>{formatShortDate(profile.weddingDate)} at {profile.venue}</Text>
          </View>
          <Pressable
            accessibilityLabel="Ask Aria"
            onPress={() => go('Aria')}
            style={({ pressed }) => [
              styles.ariaButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.78 : 1, shadowColor: colors.shadow },
            ]}
          >
            <MaterialCommunityIcons color={colors.cardStrong} name="star-four-points" size={22} />
          </Pressable>
        </View>

        <View style={styles.heroStats}>
          <HeroStat label="Days" value={String(daysUntil(profile.weddingDate))} />
          <HeroStat label="Planned" value={`${taskProgress}%`} />
          <HeroStat label="Guests" value={`${confirmedGuests}/${profile.guestTarget}`} />
        </View>
      </Card>

      <Pressable onPress={() => go('Aria')} style={({ pressed }) => [{ opacity: pressed ? 0.78 : 1 }]}>
        <Card padding={spacing.md} style={styles.nextBestCard}>
          <View style={[styles.nextIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons color={colors.primary} name="sparkles-outline" size={23} />
          </View>
          <View style={styles.nextCopy}>
            <Text style={[styles.nextEyebrow, { color: colors.primary }]}>Next Best Move</Text>
            <Text style={[styles.nextText, { color: colors.text }]}>
              Review {unsignedContracts} contracts, remind {pendingGuests} RSVP guests, and prep {nextPayment?.title ?? 'the next payment'}.
            </Text>
          </View>
          <Ionicons color={colors.accent} name="chevron-forward" size={22} />
        </Card>
      </Pressable>

      <View style={styles.sectionRow}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Planner Tools</Text>
          <Text style={[styles.sectionSub, { color: colors.muted }]}>Fast paths for the work couples do most.</Text>
        </View>
      </View>
      <View style={styles.tileGrid}>
        <FeatureTile icon="heart" label="Profile" onPress={() => go('ProfileSettings')} />
        <FeatureTile icon="image-multiple" label="Mood Board" onPress={() => go('MoodBoard')} />
        <FeatureTile icon="calendar-clock" label="Timeline" onPress={() => go('Timeline')} />
        <FeatureTile icon="checkbox-marked-outline" label="Checklist" onPress={() => go('Checklist')} />
        <FeatureTile icon="account-group" label="Guest List" onPress={() => go('Guests')} />
        <FeatureTile icon="cash-multiple" label="Budget" onPress={() => go('Budget')} />
      </View>

      <Card style={styles.progressCard}>
        <View style={styles.sectionRowCompact}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Wedding Pulse</Text>
            <Text style={[styles.sectionSub, { color: colors.muted }]}>Everything important, one glance.</Text>
          </View>
          <StatusPill status={taskProgress >= 60 ? 'On Track' : 'Pending'} />
        </View>
        <ProgressBar value={taskProgress} />
        <View style={styles.pulseGrid}>
          <PulseItem icon="people-outline" label="Confirmed" value={String(confirmedGuests)} />
          <PulseItem icon="wallet-outline" label="Paid" value={formatCurrency(totalPaid)} />
          <PulseItem icon="document-text-outline" label="Files" value={String(data.documents.length)} />
        </View>
      </Card>

      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Today</Text>
        <Pressable onPress={() => go('Checklist')}>
          <Text style={[styles.viewAll, { color: colors.primary }]}>View checklist</Text>
        </Pressable>
      </View>
      {dueTasks.map((task) => (
        <Pressable key={task.id} onPress={() => go('Checklist')} style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
          <Card padding={spacing.md} style={styles.taskCard}>
            <View style={[styles.taskIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons color={colors.primary} name="checkmark-done-outline" size={20} />
            </View>
            <View style={styles.taskCopy}>
              <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title}</Text>
              <Text style={[styles.taskMeta, { color: colors.muted }]}>{task.category} - due {formatShortDate(task.dueDate)}</Text>
            </View>
            <Ionicons color={colors.accent} name="chevron-forward" size={20} />
          </Card>
        </Pressable>
      ))}

      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Money & Vendors</Text>
        <Pressable onPress={() => go('Vendors')}>
          <Text style={[styles.viewAll, { color: colors.primary }]}>Open vendors</Text>
        </Pressable>
      </View>
      <Card style={styles.vendorCard}>
        <View style={styles.vendorHeader}>
          <View>
            <Text style={[styles.vendorName, { color: colors.text }]}>{data.vendors[0]?.name}</Text>
            <Text style={[styles.vendorMeta, { color: colors.muted }]}>
              {data.vendors[0]?.category} - {formatCurrency(data.vendors[0]?.remaining ?? 0)} remaining
            </Text>
          </View>
          <StatusPill status={data.vendors[0]?.status ?? 'Pending'} />
        </View>
        <ProgressBar value={totalBudget ? (totalPaid / totalBudget) * 100 : 0} />
        <View style={styles.vendorActions}>
          <MiniAction icon="receipt-outline" label="Contracts" onPress={() => go('Contracts')} />
          <MiniAction icon="mail-open-outline" label="Invites" onPress={() => go('Invitations')} />
          <MiniAction icon="camera-outline" label="Photo QR" onPress={() => go('GuestPhotoDrop')} />
          <MiniAction icon="globe-outline" label="Website" onPress={() => go('WebsiteEditor')} />
        </View>
      </Card>
    </Screen>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.heroStat, { backgroundColor: colors.cardStrong, borderColor: colors.border }]}>
      <Text style={[styles.heroStatValue, { color: colors.primary }]}>{value}</Text>
      <Text style={[styles.heroStatLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function PulseItem({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.pulseItem}>
      <Ionicons color={colors.accent} name={icon} size={18} />
      <Text style={[styles.pulseValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.pulseLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function MiniAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniAction,
        { backgroundColor: colors.cardStrong, borderColor: colors.border, opacity: pressed ? 0.76 : 1 },
      ]}
    >
      <Ionicons color={colors.primary} name={icon} size={17} />
      <Text style={[styles.miniActionText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  homeContent: {
    paddingBottom: 224,
  },
  ariaButton: {
    alignItems: 'center',
    borderRadius: 24,
    elevation: 6,
    height: 48,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    width: 48,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 32,
    borderWidth: 3,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  couple: {
    fontFamily: fonts.heading,
    fontSize: 32,
    lineHeight: 38,
  },
  date: {
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  greeting: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroCard: {
    marginBottom: spacing.md,
  },
  heroCopy: {
    flex: 1,
  },
  heroStat: {
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  heroStatLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroStatValue: {
    fontFamily: fonts.headingSemi,
    fontSize: 23,
    lineHeight: 28,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  miniAction: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 42,
  },
  miniActionText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  nextBestCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  nextCopy: {
    flex: 1,
  },
  nextEyebrow: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  nextIcon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  nextText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  progressCard: {
    marginBottom: spacing.lg,
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
    fontSize: 18,
  },
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionRowCompact: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
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
  taskIcon: {
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
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  vendorActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  vendorCard: {
    marginBottom: spacing.lg,
  },
  vendorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  vendorMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  vendorName: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
  },
  viewAll: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
});
