import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';

type AppRoute =
  | 'Aria'
  | 'Budget'
  | 'Checklist'
  | 'Contracts'
  | 'DayOf'
  | 'Files'
  | 'GuestPhotoDrop'
  | 'Guests'
  | 'Help'
  | 'Hotels'
  | 'Invitations'
  | 'MoodBoard'
  | 'Onboarding'
  | 'ProfileSettings'
  | 'SeatingChart'
  | 'Settings'
  | 'Timeline'
  | 'Updates'
  | 'Vendors'
  | 'WebPortal'
  | 'WebsiteEditor'
  | 'WeddingParty'
  | 'Workspace';

type FeatureItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
  route: AppRoute;
  badge?: string;
};

const featured: FeatureItem[] = [
  { icon: 'globe-outline', label: 'Website Editor', detail: 'Publish guest pages, travel, story, registry, and RSVP copy.', route: 'WebsiteEditor', badge: 'Core' },
  { icon: 'mail-open-outline', label: 'Invitations', detail: 'Save-the-dates, RSVP campaigns, opens, and responses.', route: 'Invitations', badge: 'Guest' },
  { icon: 'camera-outline', label: 'Guest Photo Drop', detail: 'QR upload settings, approval queue, captions, and gallery routing.', route: 'GuestPhotoDrop', badge: 'Live' },
  { icon: 'sparkles-outline', label: 'Aria Assistant', detail: 'Draft messages, review risks, and decide what to do next.', route: 'Aria', badge: 'AI' },
];

const groups: Array<{ title: string; items: FeatureItem[] }> = [
  {
    title: 'Plan',
    items: [
      { icon: 'compass-outline', label: 'Guided Setup', detail: 'Onboarding, venue direction, priorities, and planning handoff.', route: 'Onboarding' },
      { icon: 'heart-outline', label: 'Profile', detail: 'Couple details, venue, wedding date, and priorities.', route: 'ProfileSettings' },
      { icon: 'images-outline', label: 'Mood Board', detail: 'Palette, inspiration, and vendor-ready design notes.', route: 'MoodBoard' },
      { icon: 'calendar-clear-outline', label: 'Timeline', detail: 'Ceremony, reception, production timing, and milestones.', route: 'Timeline' },
      { icon: 'phone-portrait-outline', label: 'Day-Of', detail: 'Run-of-show, emergency kit, vendor arrivals, and packing.', route: 'DayOf' },
      { icon: 'person-add-outline', label: 'Wedding Party', detail: 'Roles, duties, attire, contacts, and day-of support.', route: 'WeddingParty' },
    ],
  },
  {
    title: 'Spend',
    items: [
      { icon: 'storefront-outline', label: 'Vendors', detail: 'Bookings, contacts, payment status, and next actions.', route: 'Vendors' },
      { icon: 'cash-outline', label: 'Budget', detail: 'Totals, paid, remaining, payment dates, and categories.', route: 'Budget' },
      { icon: 'document-text-outline', label: 'Contracts', detail: 'AI review, clause notes, risk levels, and signatures.', route: 'Contracts' },
      { icon: 'folder-open-outline', label: 'Files', detail: 'Contracts, receipts, exports, timelines, and shared documents.', route: 'Files' },
    ],
  },
  {
    title: 'Guests',
    items: [
      { icon: 'people-outline', label: 'Guest List', detail: 'RSVPs, meals, households, table notes, and reminders.', route: 'Guests' },
      { icon: 'grid-outline', label: 'Seating Chart', detail: 'Tables, capacity, assignments, meal needs, and notes.', route: 'SeatingChart' },
      { icon: 'bed-outline', label: 'Hotels', detail: 'Room blocks, rates, deadlines, shuttle notes, and contacts.', route: 'Hotels' },
    ],
  },
  {
    title: 'Operate',
    items: [
      { icon: 'business-outline', label: 'Workspace', detail: 'Planner, partner, family, and vendor collaboration.', route: 'Workspace' },
      { icon: 'phone-portrait-outline', label: 'Full Portal', detail: 'Open the authenticated website app when you need desktop-grade tools.', route: 'WebPortal' },
      { icon: 'settings-outline', label: 'Settings', detail: 'Reminders, RSVP emails, Aria memory, exports, and privacy.', route: 'Settings' },
      { icon: 'help-circle-outline', label: 'Help', detail: 'Guides, support resources, security, and legal information.', route: 'Help' },
      { icon: 'megaphone-outline', label: 'Updates', detail: 'Release notes and product improvements.', route: 'Updates' },
    ],
  },
];

export function MoreScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { data, lastSyncedAt, refresh, loading } = usePlanningData();
  const taskProgress = data.tasks.length ? Math.round((data.tasks.filter((task) => task.completed).length / data.tasks.length) * 100) : 0;
  const publishedSections = data.websiteSections.filter((section) => section.status === 'Published').length;

  return (
    <Screen onRefresh={refresh} refreshing={loading}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>Feature Hub</Text>
        <Text style={[styles.title, { color: colors.text }]}>Everything has a place.</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          The website tools are organized by what you are trying to do: plan, spend, host guests, and operate the event.
        </Text>
      </View>

      <Card style={styles.statusCard}>
        <View style={styles.statusTop}>
          <View>
            <Text style={[styles.statusTitle, { color: colors.text }]}>Website readiness</Text>
            <Text style={[styles.statusMeta, { color: colors.muted }]}>
              {publishedSections}/{data.websiteSections.length} sections published
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Refresh planning data"
            onPress={refresh}
            style={({ pressed }) => [styles.refreshButton, { backgroundColor: colors.primary, opacity: pressed ? 0.78 : 1 }]}
          >
            <Ionicons color={colors.cardStrong} name="refresh" size={18} />
          </Pressable>
        </View>
        <ProgressBar value={taskProgress} />
        <Text style={[styles.statusMeta, { color: colors.muted }]}>
          {lastSyncedAt ? `Last checked ${lastSyncedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Using sample planning data'}
        </Text>
      </Card>

      <View style={styles.featuredGrid}>
        {featured.map((item) => <FeaturedCard item={item} key={item.route} />)}
      </View>

      {groups.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text style={[styles.groupTitle, { color: colors.text }]}>{group.title}</Text>
          <View style={styles.groupList}>
            {group.items.map((item) => <FeatureRow item={item} key={item.route} />)}
          </View>
        </View>
      ))}
    </Screen>
  );
}

function FeaturedCard({ item }: { item: FeatureItem }) {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={() => navigation.navigate(item.route)}
      style={({ pressed }) => [
        styles.featuredCard,
        { backgroundColor: colors.cardStrong, borderColor: colors.border, opacity: pressed ? 0.76 : 1, shadowColor: colors.shadow },
      ]}
    >
      <View style={styles.featuredTop}>
        <View style={[styles.featuredIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name={item.icon} size={20} />
        </View>
        {item.badge ? (
          <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>{item.badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.featuredLabel, { color: colors.text }]}>{item.label}</Text>
      <Text numberOfLines={3} style={[styles.featuredDetail, { color: colors.muted }]}>{item.detail}</Text>
    </Pressable>
  );
}

function FeatureRow({ item }: { item: FeatureItem }) {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();

  return (
    <Pressable onPress={() => navigation.navigate(item.route)} style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
      <View style={[styles.row, { borderColor: colors.border }]}>
        <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name={item.icon} size={20} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
          <Text style={[styles.rowDetail, { color: colors.muted }]}>{item.detail}</Text>
        </View>
        <Ionicons color={colors.muted} name="chevron-forward" size={18} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  featuredCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    elevation: 2,
    flexBasis: '47.8%',
    minHeight: 148,
    padding: spacing.md,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  featuredDetail: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  featuredGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  featuredIcon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  featuredLabel: {
    fontFamily: fonts.headingSemi,
    fontSize: 18,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  featuredTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  group: {
    marginTop: spacing.xl,
  },
  groupList: {
    backgroundColor: 'rgba(255,255,255,0.56)',
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  groupTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  header: {
    marginBottom: spacing.lg,
  },
  refreshButton: {
    alignItems: 'center',
    borderRadius: radii.xl,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowCopy: {
    flex: 1,
  },
  rowDetail: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  rowIcon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  rowLabel: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  statusCard: {
    gap: spacing.md,
  },
  statusMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  statusTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 22,
  },
  statusTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 32,
    lineHeight: 36,
    marginTop: 2,
  },
});
