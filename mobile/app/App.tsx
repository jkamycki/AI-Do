import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { samplePlanningData } from './src/data/sampleData';
import { daysFromToday, daysUntil, formatCurrency, formatDeadlineLabel, formatShortDate } from './src/utils/format';

const logo = require('./assets/aido-logo.png');
const ariaAvatar = require('./assets/aria-avatar.png');
const couplePhotoUri =
  'https://images.unsplash.com/photo-1529634806980-85c3dd6d34ac?auto=format&fit=crop&w=420&q=80';

type TabId = 'today' | 'plan' | 'guests' | 'money' | 'more';

const colors = {
  bg: '#FFF8F4',
  surface: '#FFFFFF',
  surfaceWarm: '#FFF2EA',
  ink: '#271B22',
  muted: '#765D67',
  faint: '#EFE1E5',
  rose: '#A93D5B',
  roseSoft: '#F8DDE5',
  gold: '#B98343',
  goldSoft: '#F4DEBE',
  green: '#637B59',
  blue: '#496D89',
};

const tabs: Array<{ id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'today', label: 'Today', icon: 'home-outline' },
  { id: 'plan', label: 'Plan', icon: 'calendar-clear-outline' },
  { id: 'guests', label: 'Guests', icon: 'people-outline' },
  { id: 'money', label: 'Money', icon: 'wallet-outline' },
  { id: 'more', label: 'More', icon: 'grid-outline' },
];

const featureGroups = [
  {
    title: 'Plan the wedding',
    items: [
      ['Guided setup', 'Profile, venue, priorities, and onboarding.', 'compass-outline'],
      ['Checklist', 'Deadline tasks, reminders, and progress.', 'checkbox-outline'],
      ['Timeline', 'Ceremony, reception, production, and day-of timing.', 'calendar-clear-outline'],
      ['Mood board', 'Palette, inspiration, and vendor-ready design notes.', 'images-outline'],
      ['Wedding party', 'Roles, attire, duties, and contact sheet.', 'person-add-outline'],
      ['Day-of command', 'Run-of-show, packing, vendor arrivals, and emergency kit.', 'phone-portrait-outline'],
    ],
  },
  {
    title: 'Host guests',
    items: [
      ['Guest list', 'RSVPs, meals, households, and reminders.', 'people-outline'],
      ['Invitations', 'Save-the-dates, RSVP campaigns, opens, and responses.', 'mail-open-outline'],
      ['Wedding website', 'Story, schedule, registry, travel, and publishing.', 'globe-outline'],
      ['Seating chart', 'Tables, capacity, meal needs, and assignments.', 'grid-outline'],
      ['Hotels', 'Room blocks, rates, shuttle notes, and deadlines.', 'bed-outline'],
      ['Photo drop', 'QR uploads, approval queue, captions, and gallery routing.', 'camera-outline'],
    ],
  },
  {
    title: 'Run the business side',
    items: [
      ['Vendors', 'Bookings, contacts, payment status, and next actions.', 'storefront-outline'],
      ['Budget', 'Totals, paid, remaining, payment dates, and categories.', 'cash-outline'],
      ['Contracts', 'AI review, risk levels, clauses, and signing status.', 'document-text-outline'],
      ['Documents', 'Receipts, contracts, exports, timelines, and shared files.', 'folder-open-outline'],
      ['Workspace', 'Partner, planner, family, and vendor collaboration.', 'business-outline'],
      ['Settings & privacy', 'Reminders, RSVP emails, Aria memory, data export.', 'settings-outline'],
    ],
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const { width } = useWindowDimensions();
  const data = samplePlanningData;
  const [fontsLoaded] = useFonts({
    Inter_400Regular: require('./assets/fonts/Inter_400Regular.ttf'),
    Inter_500Medium: require('./assets/fonts/Inter_500Medium.ttf'),
    Inter_600SemiBold: require('./assets/fonts/Inter_600SemiBold.ttf'),
    Inter_700Bold: require('./assets/fonts/Inter_700Bold.ttf'),
    PlayfairDisplay_600SemiBold: require('./assets/fonts/PlayfairDisplay_600SemiBold.ttf'),
    PlayfairDisplay_700Bold: require('./assets/fonts/PlayfairDisplay_700Bold.ttf'),
  });

  const stats = useMemo(() => {
    const completeTasks = data.tasks.filter((task) => task.completed).length;
    const progress = data.tasks.length ? Math.round((completeTasks / data.tasks.length) * 100) : 0;
    const confirmed = data.guests.filter((guest) => guest.rsvp === 'Confirmed').length;
    const pending = data.guests.filter((guest) => guest.rsvp === 'Pending').length;
    const paid = data.budget.reduce((sum, item) => sum + item.paid, 0);
    const total = data.budget.reduce((sum, item) => sum + item.total, 0);
    const reviewContracts = data.contracts.filter((contract) => contract.status !== 'Signed').length;
    const websiteDrafts = data.websiteSections.filter((section) => section.status !== 'Published').length;
    return { progress, confirmed, pending, paid, total, reviewContracts, websiteDrafts };
  }, [data]);

  const maxWidth = Math.min(width, 560);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <Image resizeMode="contain" source={logo} style={styles.loadingLogo} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={[styles.scrollContent, { maxWidth }]} showsVerticalScrollIndicator={false}>
        <Header />
        {activeTab === 'today' ? (
          <>
            <Hero progress={stats.progress} confirmed={stats.confirmed} />
            <ActionStrip pending={stats.pending} reviewContracts={stats.reviewContracts} websiteDrafts={stats.websiteDrafts} />
            <TodaySection />
          </>
        ) : null}
        {activeTab === 'plan' ? <PlanSection progress={stats.progress} /> : null}
        {activeTab === 'guests' ? <GuestsSection confirmed={stats.confirmed} pending={stats.pending} /> : null}
        {activeTab === 'money' ? <MoneySection paid={stats.paid} total={stats.total} /> : null}
        {activeTab === 'more' ? <FeatureHub /> : null}
      </ScrollView>
      <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} />
    </View>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Image resizeMode="contain" source={logo} style={styles.logo} />
      <View style={styles.headerActions}>
        <Pressable style={styles.ariaHeaderButton}>
          <Image resizeMode="cover" source={ariaAvatar} style={styles.ariaHeaderImage} />
        </Pressable>
        <RoundButton icon="person-outline" />
      </View>
    </View>
  );
}

function Hero({ confirmed, progress }: { confirmed: number; progress: number }) {
  const profile = samplePlanningData.profile;

  return (
    <LinearGradient colors={['#FFF8F4', '#FFE8DE']} style={styles.hero}>
      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>AI wedding planning OS</Text>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live plan</Text>
        </View>
      </View>
      <Text style={styles.heroTitle}>{profile.coupleName}</Text>
      <Text style={styles.heroMeta}>{formatShortDate(profile.weddingDate)} at {profile.venue}</Text>
      <View style={styles.profilePhotoWrap}>
        <Image resizeMode="cover" source={{ uri: couplePhotoUri }} style={styles.profilePhoto} />
        <View style={styles.photoBadge}>
          <Text style={styles.photoBadgeText}>{profile.photoInitials}</Text>
        </View>
      </View>
      <View style={styles.heroStats}>
        <StatCard label="Days" value={String(daysUntil(profile.weddingDate))} />
        <StatCard label="Planned" value={`${progress}%`} />
        <StatCard label="Guests" value={`${confirmed}/${profile.guestTarget}`} />
      </View>
    </LinearGradient>
  );
}

function ActionStrip({ pending, reviewContracts, websiteDrafts }: { pending: number; reviewContracts: number; websiteDrafts: number }) {
  return (
    <Card style={styles.actionCard}>
      <View style={styles.actionIcon}>
        <Image resizeMode="cover" source={ariaAvatar} style={styles.actionAvatar} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.overline}>Aria recommends</Text>
        <Text style={styles.actionText}>
          Review {reviewContracts} contracts, remind {pending} guests, and finish {websiteDrafts} website sections.
        </Text>
      </View>
    </Card>
  );
}

function TodaySection() {
  const tasks = samplePlanningData.tasks
    .filter((task) => !task.completed)
    .sort((a, b) => (daysFromToday(a.dueDate) ?? 999) - (daysFromToday(b.dueDate) ?? 999))
    .slice(0, 4);

  return (
    <Section title="Start here" subtitle="Only the work that moves the wedding forward.">
      {tasks.map((task) => (
        <TaskRow key={task.id} title={task.title} meta={`${task.category} - ${formatDeadlineLabel(task.dueDate)}`} />
      ))}
      <View style={styles.twoColumn}>
        <FeatureMini icon="globe-outline" label="Publish website" detail="Travel and registry need review." />
        <FeatureMini icon="camera-outline" label="Photo drop" detail="QR upload flow is ready." />
      </View>
    </Section>
  );
}

function PlanSection({ progress }: { progress: number }) {
  return (
    <Section title="Planning map" subtitle="From setup to the wedding-day run of show.">
      <Card>
        <Text style={styles.cardTitle}>Overall readiness</Text>
        <Progress value={progress} />
        <Text style={styles.mutedText}>{progress}% of core planning tasks are complete.</Text>
      </Card>
      <View style={styles.twoColumn}>
        <FeatureMini icon="compass-outline" label="Guided setup" detail="Venue, priorities, and basics." />
        <FeatureMini icon="images-outline" label="Mood board" detail="Style direction for vendors." />
        <FeatureMini icon="calendar-clear-outline" label="Timeline" detail="Ceremony and reception flow." />
        <FeatureMini icon="phone-portrait-outline" label="Day-of" detail="Packing and vendor arrivals." />
      </View>
    </Section>
  );
}

function GuestsSection({ confirmed, pending }: { confirmed: number; pending: number }) {
  return (
    <Section title="Guest experience" subtitle="Invites, RSVP, seating, hotels, and the public website.">
      <View style={styles.summaryGrid}>
        <SummaryCard label="Confirmed" value={String(confirmed)} />
        <SummaryCard label="Pending" value={String(pending)} />
        <SummaryCard label="Tables" value={String(samplePlanningData.seating.length)} />
      </View>
      <View style={styles.twoColumn}>
        <FeatureMini icon="mail-open-outline" label="Invitations" detail="Save dates and RSVP suite." />
        <FeatureMini icon="people-outline" label="Guest list" detail="Meals, RSVP, households." />
        <FeatureMini icon="grid-outline" label="Seating chart" detail="Tables and assignments." />
        <FeatureMini icon="bed-outline" label="Hotels" detail="Room blocks and shuttle notes." />
      </View>
    </Section>
  );
}

function MoneySection({ paid, total }: { paid: number; total: number }) {
  const percent = total ? Math.round((paid / total) * 100) : 0;
  const nextPayment = samplePlanningData.budget.find((item) => item.nextPayment);

  return (
    <Section title="Money and vendors" subtitle="Budget, vendor commitments, contracts, and files.">
      <Card>
        <Text style={styles.cardTitle}>Budget health</Text>
        <View style={styles.moneyRow}>
          <Text style={styles.moneyValue}>{formatCurrency(paid)}</Text>
          <Text style={styles.moneyMeta}>of {formatCurrency(total)}</Text>
        </View>
        <Progress value={percent} />
        <Text style={styles.mutedText}>{nextPayment?.title} has the next scheduled payment.</Text>
      </Card>
      <View style={styles.twoColumn}>
        <FeatureMini icon="storefront-outline" label="Vendors" detail={`${samplePlanningData.vendors.length} vendor records.`} />
        <FeatureMini icon="document-text-outline" label="Contracts" detail="AI risk review and clauses." />
        <FeatureMini icon="folder-open-outline" label="Documents" detail="Receipts and signed files." />
        <FeatureMini icon="cash-outline" label="Budget" detail="Payments and categories." />
      </View>
    </Section>
  );
}

function FeatureHub() {
  return (
    <Section title="All features" subtitle="Everything from the website, grouped so it is easy to find.">
      {featureGroups.map((group) => (
        <View key={group.title} style={styles.groupBlock}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          {group.items.map(([label, detail, icon]) => (
            <HubRow key={label} icon={icon as keyof typeof Ionicons.glyphMap} label={label} detail={detail} />
          ))}
        </View>
      ))}
    </Section>
  );
}

function BottomTabs({ activeTab, setActiveTab }: { activeTab: TabId; setActiveTab: (tab: TabId) => void }) {
  return (
    <View style={styles.tabShell}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={styles.tabButton}>
            <View style={[styles.tabIcon, active && styles.tabIconActive]}>
              <Ionicons color={active ? colors.rose : colors.muted} name={tab.icon} size={22} />
            </View>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({ children, subtitle, title }: { children: React.ReactNode; subtitle: string; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function FeatureMini({ detail, icon, label }: { detail: string; icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <Pressable style={styles.miniCard}>
      <View style={styles.miniIcon}>
        <Ionicons color={colors.rose} name={icon} size={21} />
      </View>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniDetail}>{detail}</Text>
    </Pressable>
  );
}

function HubRow({ detail, icon, label }: { detail: string; icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <Pressable style={styles.hubRow}>
      <View style={styles.hubIcon}>
        <Ionicons color={colors.rose} name={icon} size={20} />
      </View>
      <View style={styles.hubCopy}>
        <Text style={styles.hubLabel}>{label}</Text>
        <Text style={styles.hubDetail}>{detail}</Text>
      </View>
      <Ionicons color={colors.muted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function TaskRow({ meta, title }: { meta: string; title: string }) {
  return (
    <Card style={styles.taskRow}>
      <View style={styles.checkIcon}>
        <Ionicons color={colors.rose} name="checkmark" size={18} />
      </View>
      <View style={styles.taskCopy}>
        <Text style={styles.taskTitle}>{title}</Text>
        <Text style={styles.taskMeta}>{meta}</Text>
      </View>
    </Card>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(4, Math.min(100, value))}%` }]} />
    </View>
  );
}

function RoundButton({ filled = false, icon }: { filled?: boolean; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable style={[styles.roundButton, filled && styles.roundButtonFilled]}>
      <Ionicons color={filled ? colors.rose : colors.gold} name={icon} size={21} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  loading: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    flex: 1,
    justifyContent: 'center',
  },
  loadingLogo: {
    height: 150,
    width: 150,
  },
  scrollContent: {
    alignSelf: 'center',
    paddingBottom: 132,
    paddingHorizontal: 18,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingTop: 14,
  },
  logo: {
    height: 58,
    width: 96,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  ariaHeaderButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  ariaHeaderImage: {
    height: '100%',
    width: '100%',
  },
  roundButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  roundButtonFilled: {
    backgroundColor: colors.roseSoft,
  },
  hero: {
    borderColor: colors.faint,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 20,
  },
  kickerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kicker: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  livePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveDot: {
    backgroundColor: colors.green,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  liveText: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  heroTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    lineHeight: 36,
    marginTop: 16,
  },
  heroMeta: {
    color: colors.muted,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  photoBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 18,
    borderWidth: 2,
    bottom: 10,
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    width: 42,
  },
  photoBadgeText: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  profilePhoto: {
    height: 138,
    width: '100%',
  },
  profilePhotoWrap: {
    borderColor: 'rgba(255,255,255,0.86)',
    borderRadius: 22,
    borderWidth: 3,
    marginTop: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  heroStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statValue: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
  },
  statLabel: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  actionCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginTop: 14,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.roseSoft,
    borderRadius: 26,
    borderWidth: 2,
    height: 54,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 54,
  },
  actionAvatar: {
    height: '100%',
    width: '100%',
  },
  actionCopy: {
    flex: 1,
  },
  overline: {
    color: colors.rose,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  actionText: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 25,
    lineHeight: 30,
  },
  sectionSubtitle: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
  sectionBody: {
    gap: 10,
    marginTop: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#552636',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
  },
  taskRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  checkIcon: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  taskCopy: {
    flex: 1,
  },
  taskTitle: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  taskMeta: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  twoColumn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  miniCard: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 20,
    borderWidth: 1,
    flexBasis: '48%',
    minHeight: 140,
    padding: 15,
  },
  miniIcon: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    marginBottom: 12,
    width: 42,
  },
  miniLabel: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  miniDetail: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 23,
  },
  mutedText: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  progressTrack: {
    backgroundColor: colors.roseSoft,
    borderRadius: 999,
    height: 10,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.rose,
    borderRadius: 999,
    height: '100%',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  summaryValue: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 26,
  },
  summaryLabel: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  moneyRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  moneyValue: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 34,
  },
  moneyMeta: {
    color: colors.muted,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    marginBottom: 8,
  },
  groupBlock: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupTitle: {
    color: colors.ink,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  hubRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  hubIcon: {
    alignItems: 'center',
    backgroundColor: colors.roseSoft,
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  hubCopy: {
    flex: 1,
  },
  hubLabel: {
    color: colors.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  hubDetail: {
    color: colors.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  tabShell: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 30,
    borderWidth: 1,
    bottom: 18,
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'space-between',
    left: 14,
    maxWidth: 540,
    padding: 8,
    position: 'absolute',
    right: 14,
    shadowColor: '#552636',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  tabIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 38,
    justifyContent: 'center',
    width: 44,
  },
  tabIconActive: {
    backgroundColor: colors.roseSoft,
  },
  tabLabel: {
    color: colors.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  tabLabelActive: {
    color: colors.rose,
  },
});
