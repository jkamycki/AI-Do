import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';

type AppMapItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
  route: string;
};

const planningItems: AppMapItem[] = [
  { icon: 'sparkles-outline', label: 'Guided Setup', detail: 'New couple onboarding, venue direction, and Aria handoff', route: 'Onboarding' },
  { icon: 'heart-outline', label: 'Profile', detail: 'Couple details, date, venue, notifications', route: 'ProfileSettings' },
  { icon: 'images-outline', label: 'Mood Board', detail: 'Palette, inspiration, vendor-ready style notes', route: 'MoodBoard' },
  { icon: 'calendar-clear-outline', label: 'Timeline', detail: 'Ceremony, reception, and production timing', route: 'Timeline' },
  { icon: 'phone-portrait-outline', label: 'Day-Of Coordinator', detail: 'Run-of-show, ceremony, setup, vendor contacts, and packing', route: 'DayOf' },
  { icon: 'person-add-outline', label: 'Wedding Party', detail: 'Roles, duties, attire status, and phone numbers for wedding-day support', route: 'WeddingParty' },
];

const moneyItems: AppMapItem[] = [
  { icon: 'storefront-outline', label: 'Vendors', detail: 'Bookings, status, payments, next actions', route: 'Vendors' },
  { icon: 'cash-outline', label: 'Budget', detail: 'Totals, paid, remaining, and due dates', route: 'Budget' },
  { icon: 'document-text-outline', label: 'Contracts', detail: 'AI review, risks, clauses, signing status', route: 'Contracts' },
  { icon: 'folder-open-outline', label: 'Documents', detail: 'Receipts, contracts, exports, shared files', route: 'Files' },
];

const guestItems: AppMapItem[] = [
  { icon: 'people-outline', label: 'Guest List', detail: 'RSVPs, meals, tables, reminders', route: 'Guests' },
  { icon: 'mail-open-outline', label: 'Invitations & RSVP', detail: 'Save-the-dates, digital invites, response tracking', route: 'Invitations' },
  { icon: 'grid-outline', label: 'Seating Chart', detail: 'Tables, capacity, assignments, AI suggestions', route: 'SeatingChart' },
  { icon: 'bed-outline', label: 'Hotels', detail: 'Room blocks, rates, deadlines, shuttle notes', route: 'Hotels' },
];

const publishingItems: AppMapItem[] = [
  { icon: 'globe-outline', label: 'Website Editor', detail: 'Guest site, travel, registry, publishing', route: 'WebsiteEditor' },
  { icon: 'camera-outline', label: 'Guest Photo Drop', detail: 'Wedding-day QR uploads, approval queue, captions, and gallery destination', route: 'GuestPhotoDrop' },
  { icon: 'phone-portrait-outline', label: 'Website Portal', detail: 'Fallback access to the full authenticated website', route: 'WebPortal' },
  { icon: 'business-outline', label: 'Workspace Sharing', detail: 'Planner, partner, family, vendor access', route: 'Workspace' },
  { icon: 'settings-outline', label: 'Settings & Privacy', detail: 'Reminders, RSVP emails, Aria memory, data export', route: 'Settings' },
  { icon: 'help-circle-outline', label: 'Help & Support', detail: 'Guides, support, legal, security help', route: 'Help' },
  { icon: 'megaphone-outline', label: 'Updates', detail: 'Release notes and improvements', route: 'Updates' },
];

export function MoreScreen() {
  const navigation = useNavigation<any>();
  const { colors, mode, toggleMode } = useAppTheme();
  const { data, lastSyncedAt, refresh, loading } = usePlanningData();
  const taskProgress = data.tasks.length ? Math.round((data.tasks.filter((task) => task.completed).length / data.tasks.length) * 100) : 0;

  return (
    <Screen onRefresh={refresh} refreshing={loading}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>A.I Do Studio</Text>
        <Text style={[styles.title, { color: colors.text }]}>Everything</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          The complete mobile map for your wedding website, guests, vendors, budget, documents, AI assistant, and workspace.
        </Text>
      </View>

      <Pressable onPress={() => navigation.navigate('Aria')} style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
        <Card style={styles.assistantCard}>
          <View style={[styles.aiIcon, { backgroundColor: colors.primarySoft }]}>
            <MaterialCommunityIcons color={colors.primary} name="star-four-points-outline" size={28} />
          </View>
          <View style={styles.aiCopy}>
            <Text style={[styles.aiTitle, { color: colors.text }]}>Aria Assistant</Text>
            <Text style={[styles.aiBody, { color: colors.muted }]}>Draft emails, review contracts, find budget risks, and decide what to do next.</Text>
          </View>
          <Ionicons color={colors.accent} name="chevron-forward" size={22} />
        </Card>
      </Pressable>

      <Card style={styles.syncPanel}>
        <View style={styles.syncTop}>
          <View>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Website Sync</Text>
            <Text style={[styles.settingMeta, { color: colors.muted }]}>
              {lastSyncedAt ? `Last checked ${lastSyncedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Using sample planning data'}
            </Text>
          </View>
          <Pressable
            onPress={refresh}
            style={({ pressed }) => [styles.syncButton, { backgroundColor: colors.primary, opacity: pressed ? 0.78 : 1 }]}
          >
            <Ionicons color={colors.cardStrong} name="refresh" size={18} />
          </Pressable>
        </View>
        <ProgressBar value={taskProgress} />
        <Text style={[styles.settingMeta, { color: colors.muted }]}>{taskProgress}% of core planning tasks complete</Text>
      </Card>

      <MenuGroup title="Planning OS">
        {planningItems.map((item) => <MenuItem item={item} key={item.route} />)}
      </MenuGroup>

      <MenuGroup title="Money & Vendors">
        {moneyItems.map((item) => <MenuItem item={item} key={item.route} />)}
      </MenuGroup>

      <MenuGroup title="Guests & Experience">
        {guestItems.map((item) => <MenuItem item={item} key={item.route} />)}
      </MenuGroup>

      <MenuGroup title="Publishing & Workspace">
        {publishingItems.map((item) => <MenuItem item={item} key={item.route} />)}
      </MenuGroup>

      <Card style={styles.settingRow}>
        <View style={styles.settingCopy}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>Dark Mode</Text>
          <Text style={[styles.settingMeta, { color: colors.muted }]}>{mode === 'dark' ? 'Soft evening palette' : 'Cream, blush, and gold palette'}</Text>
        </View>
        <Switch
          onValueChange={toggleMode}
          thumbColor={mode === 'dark' ? colors.accent : colors.cardStrong}
          trackColor={{ false: colors.primarySoft, true: colors.primary }}
          value={mode === 'dark'}
        />
      </Card>
    </Screen>
  );
}

function MenuGroup({ children, title }: { children: ReactNode; title: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: colors.primary }]}>{title}</Text>
      {children}
    </View>
  );
}

function MenuItem({ item }: { item: AppMapItem }) {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();

  return (
    <Pressable onPress={() => navigation.navigate(item.route)} style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
      <Card padding={spacing.md} style={styles.menuItem}>
        <View style={[styles.menuIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name={item.icon} size={21} />
        </View>
        <View style={styles.menuCopy}>
          <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
          <Text style={[styles.menuDetail, { color: colors.muted }]}>{item.detail}</Text>
        </View>
        <Ionicons color={colors.muted} name="chevron-forward" size={20} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  assistantCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  aiBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 2,
  },
  aiCopy: {
    flex: 1,
  },
  aiIcon: {
    alignItems: 'center',
    borderRadius: radii.lg,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  aiTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 23,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  group: {
    marginTop: spacing.lg,
  },
  groupTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  header: {
    marginBottom: spacing.lg,
  },
  menuCopy: {
    flex: 1,
  },
  menuDetail: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  menuIcon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  menuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  menuLabel: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  settingCopy: {
    flex: 1,
  },
  settingMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  settingTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  syncButton: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  syncPanel: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  syncTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 44,
    lineHeight: 50,
  },
});
