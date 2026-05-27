import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { KeyboardTypeOptions, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';
import { formatShortDate } from '../utils/format';

const priorityOptions = [
  'Budget-friendly',
  'Specific date availability',
  'Indoor option',
  'Outdoor option',
  'ADA accessible',
  'Parking included',
  'Private getting-ready suite',
  'Backup weather plan',
  'Scenic photo spots',
  'Open bar',
  'Late-night food',
  'On-site lodging',
  'Hidden fees',
  'Noise curfews',
  'Mandatory in-house catering',
];

export function ProfileSettingsScreen() {
  const { colors } = useAppTheme();
  const { data, updateProfile } = usePlanningData();
  const profile = data.profile;
  const [notifications, setNotifications] = useState(data.profile.notificationsEnabled);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    guestTarget: String(profile.guestTarget),
    location: profile.location,
    photoInitials: profile.photoInitials,
    partnerOne: profile.partnerOne,
    partnerTwo: profile.partnerTwo,
    totalBudget: String(profile.totalBudget),
    venue: profile.venue,
    weddingDate: toDateInputValue(profile.weddingDate),
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) {
      setForm({
        guestTarget: String(profile.guestTarget),
        location: profile.location,
        photoInitials: profile.photoInitials,
        partnerOne: profile.partnerOne,
        partnerTwo: profile.partnerTwo,
        totalBudget: String(profile.totalBudget),
        venue: profile.venue,
        weddingDate: toDateInputValue(profile.weddingDate),
      });
    }
  }, [editing, profile.guestTarget, profile.location, profile.partnerOne, profile.partnerTwo, profile.photoInitials, profile.totalBudget, profile.venue, profile.weddingDate]);

  const setField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const saveProfile = () => {
    const partnerOne = form.partnerOne.trim();
    const partnerTwo = form.partnerTwo.trim();
    const venue = form.venue.trim();
    const weddingDate = form.weddingDate.trim();
    const guestTarget = Number.parseInt(form.guestTarget.trim(), 10);
    const totalBudget = Number.parseFloat(form.totalBudget.trim());
    const photoInitials = form.photoInitials.trim().slice(0, 5).toUpperCase();

    if (!partnerOne || !partnerTwo || !venue || !isValidDateInput(weddingDate) || Number.isNaN(guestTarget) || guestTarget < 1) {
      setError('Add both names, a venue, a wedding date, and a guest goal.');
      return;
    }

    updateProfile({
      coupleName: `${partnerOne} & ${partnerTwo}`,
      guestTarget,
      partnerOne,
      partnerTwo,
      photoInitials: photoInitials || `${partnerOne[0]}&${partnerTwo[0]}`.toUpperCase(),
      location: form.location.trim() || profile.location,
      totalBudget: Number.isFinite(totalBudget) && totalBudget > 0 ? totalBudget : profile.totalBudget,
      venue,
      weddingDate: normalizeWeddingDate(weddingDate),
    });
    setEditing(false);
  };

  const toggleNotifications = (enabled: boolean) => {
    setNotifications(enabled);
    updateProfile({ notificationsEnabled: enabled });
  };

  const togglePriority = (option: string) => {
    const current = profile.priorities;
    const removeFromAll = {
      mustAvoid: current.mustAvoid.filter((item) => item !== option),
      mustHave: current.mustHave.filter((item) => item !== option),
      niceToHave: current.niceToHave.filter((item) => item !== option),
    };

    if (current.mustHave.includes(option)) {
      updateProfile({ priorities: { ...removeFromAll, niceToHave: [...removeFromAll.niceToHave, option] } });
      return;
    }

    if (current.niceToHave.includes(option)) {
      updateProfile({ priorities: { ...removeFromAll, mustAvoid: [...removeFromAll.mustAvoid, option] } });
      return;
    }

    if (current.mustAvoid.includes(option)) {
      updateProfile({ priorities: removeFromAll });
      return;
    }

    updateProfile({ priorities: { ...removeFromAll, mustHave: [...removeFromAll.mustHave, option] } });
  };

  return (
    <Screen>
      <SectionHeader subtitle="Personalize your planning space and account preferences." title="Profile" />

      <Card style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{profile.photoInitials}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={[styles.name, { color: colors.text }]}>{profile.coupleName}</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>{formatShortDate(profile.weddingDate)}</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>{profile.venue}</Text>
        </View>
        <Pressable
          accessibilityLabel="Edit wedding profile"
          onPress={() => setEditing((current) => !current)}
          style={({ pressed }) => [
            styles.editButton,
            { backgroundColor: colors.cardStrong, borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
          ]}
        >
          <Ionicons color={colors.primary} name={editing ? 'close' : 'pencil'} size={17} />
          <Text style={[styles.editText, { color: colors.primary }]}>{editing ? 'Close' : 'Edit'}</Text>
        </Pressable>
      </Card>

      {editing ? (
        <Card style={styles.editCard}>
          <View style={styles.editHeader}>
            <View>
              <Text style={[styles.editTitle, { color: colors.text }]}>Wedding Profile</Text>
              <Text style={[styles.editMeta, { color: colors.muted }]}>These details personalize your dashboard, guest tools, and timeline.</Text>
            </View>
            <View style={[styles.editIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons color={colors.primary} name="heart" size={20} />
            </View>
          </View>

          <View style={styles.twoColumn}>
            <ProfileField label="Partner 1" onChangeText={(value) => setField('partnerOne', value)} value={form.partnerOne} />
            <ProfileField label="Partner 2" onChangeText={(value) => setField('partnerTwo', value)} value={form.partnerTwo} />
          </View>
          <ProfileField label="Wedding date" onChangeText={(value) => setField('weddingDate', value)} placeholder="YYYY-MM-DD" value={form.weddingDate} />
          <View style={styles.twoColumn}>
            <ProfileField label="Venue" onChangeText={(value) => setField('venue', value)} value={form.venue} />
            <ProfileField label="Location" onChangeText={(value) => setField('location', value)} value={form.location} />
          </View>
          <View style={styles.twoColumn}>
            <ProfileField
              keyboardType="number-pad"
              label="Guest goal"
              onChangeText={(value) => setField('guestTarget', value)}
              value={form.guestTarget}
            />
            <ProfileField keyboardType="number-pad" label="Budget" onChangeText={(value) => setField('totalBudget', value)} value={form.totalBudget} />
          </View>
          <View style={styles.twoColumn}>
            <ProfileField label="Initials" onChangeText={(value) => setField('photoInitials', value)} value={form.photoInitials} />
          </View>

          {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}

          <View style={styles.editActions}>
            <PrimaryButton label="Cancel" onPress={() => setEditing(false)} variant="ghost" />
            <PrimaryButton icon="checkmark-outline" label="Save Changes" onPress={saveProfile} />
          </View>
        </Card>
      ) : null}

      <Card style={styles.settingCard}>
        <SettingRow
          icon="notifications-outline"
          label="Notifications"
          meta="Payment reminders, RSVP changes, and checklist due dates"
          right={
            <Switch
              onValueChange={toggleNotifications}
              thumbColor={notifications ? colors.cardStrong : colors.cardStrong}
              trackColor={{ false: colors.primarySoft, true: colors.primary }}
              value={notifications}
            />
          }
        />
      </Card>

      <Card style={styles.priorityCard}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Wedding Priorities</Text>
        <Text style={[styles.accountMeta, { color: colors.muted }]}>Tap any option to cycle through Must Have, Nice to Have, Must Avoid, or off.</Text>
        <View style={styles.priorityGrid}>
          {priorityOptions.map((option) => {
            const status = priorityStatus(option, profile.priorities);
            return (
              <Pressable
                key={option}
                onPress={() => togglePriority(option)}
                style={({ pressed }) => [
                  styles.priorityChip,
                  {
                    backgroundColor: priorityColor(status, colors),
                    borderColor: colors.border,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Text style={[styles.priorityText, { color: colors.text }]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.priorityColumns}>
          <PriorityColumn color="#CFE8D3" items={profile.priorities.mustHave} title="Must Have" />
          <PriorityColumn color="#F6E2AE" items={profile.priorities.niceToHave} title="Nice" />
          <PriorityColumn color="#F3C0C4" items={profile.priorities.mustAvoid} title="Avoid" />
        </View>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
        <View style={styles.accountRow}>
          <MaterialCommunityIcons color={colors.accent} name="shield-check-outline" size={23} />
          <View style={styles.accountCopy}>
            <Text style={[styles.accountTitle, { color: colors.text }]}>Website profile API</Text>
            <Text style={[styles.accountMeta, { color: colors.muted }]}>Ready for secure login and account sync when the endpoint is connected.</Text>
          </View>
        </View>
        <PrimaryButton icon="log-out-outline" label="Manage Account" variant="ghost" />
      </Card>
    </Screen>
  );
}

function priorityStatus(option: string, priorities: { mustHave: string[]; niceToHave: string[]; mustAvoid: string[] }) {
  if (priorities.mustHave.includes(option)) return 'must';
  if (priorities.niceToHave.includes(option)) return 'nice';
  if (priorities.mustAvoid.includes(option)) return 'avoid';
  return 'off';
}

function priorityColor(status: string, colors: ReturnType<typeof useAppTheme>['colors']) {
  if (status === 'must') return 'rgba(141, 148, 106, 0.24)';
  if (status === 'nice') return colors.accentSoft;
  if (status === 'avoid') return 'rgba(215, 129, 132, 0.24)';
  return colors.cardStrong;
}

function PriorityColumn({ color, items, title }: { color: string; items: string[]; title: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.priorityColumn, { backgroundColor: color }]}>
      <Text style={[styles.priorityColumnTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.priorityColumnText, { color: colors.text }]}>{items.length ? items.join(', ') : 'None yet'}</Text>
    </View>
  );
}

function ProfileField({
  keyboardType,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  keyboardType?: KeyboardTypeOptions;
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <TextInput
        autoCapitalize="words"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        style={[styles.input, { backgroundColor: colors.cardStrong, borderColor: colors.border, color: colors.text }]}
        value={value}
      />
    </View>
  );
}

function toDateInputValue(value: string) {
  if (!value) {
    return '';
  }

  return value.includes('T') ? value.split('T')[0] : value;
}

function isValidDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00.000Z`).getTime());
}

function normalizeWeddingDate(value: string) {
  return `${value}T17:00:00.000Z`;
}

function SettingRow({ icon, label, meta, right }: { icon: keyof typeof Ionicons.glyphMap; label: string; meta: string; right: React.ReactNode }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.settingRow}>
      <View style={[styles.settingIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons color={colors.primary} name={icon} size={21} />
      </View>
      <View style={styles.settingCopy}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.settingMeta, { color: colors.muted }]}>{meta}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 34,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  profileCopy: {
    flex: 1,
  },
  editButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  editText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  name: {
    fontFamily: fonts.headingSemi,
    fontSize: 29,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: 2,
  },
  editCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  editHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  editIcon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  editTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
  },
  editMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  twoColumn: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
    gap: spacing.xs,
  },
  fieldLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  errorText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  settingCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  priorityCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  priorityChip: {
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  priorityColumn: {
    borderRadius: radii.md,
    flex: 1,
    minHeight: 92,
    padding: spacing.sm,
  },
  priorityColumns: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priorityColumnText: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  priorityColumnTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  priorityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  priorityText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  settingIcon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  settingCopy: {
    flex: 1,
  },
  settingLabel: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  settingMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  divider: {
    height: 1,
  },
  themeButtons: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
    marginBottom: spacing.md,
  },
  accountRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  accountCopy: {
    flex: 1,
  },
  accountTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  accountMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
});
