import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { FilterPill } from '../components/FilterPill';
import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';

const reminderChoices = [1, 3, 7, 14];

export function SettingsScreen() {
  const { colors, mode, setMode } = useAppTheme();
  const {
    addRsvpResponseEmail,
    data,
    exportPlanningData,
    removeRsvpResponseEmail,
    updateSettings,
  } = usePlanningData();
  const [emailDraft, setEmailDraft] = useState('');
  const [ariaMemory, setAriaMemory] = useState(data.settings.ariaMemory);
  const [exportMessage, setExportMessage] = useState('');
  const [savedMemory, setSavedMemory] = useState(false);

  useEffect(() => {
    setAriaMemory(data.settings.ariaMemory);
  }, [data.settings.ariaMemory]);

  function saveEmail() {
    addRsvpResponseEmail(emailDraft);
    setEmailDraft('');
  }

  function saveAriaMemory() {
    updateSettings({ ariaMemory });
    setSavedMemory(true);
    setTimeout(() => setSavedMemory(false), 1800);
  }

  async function downloadData() {
    const fileUri = `${FileSystem.cacheDirectory}aido-planning-backup.json`;
    const backup = {
      exportedAt: new Date().toISOString(),
      app: 'A.I Do Mobile',
      data,
    };

    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backup, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    exportPlanningData();

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        dialogTitle: 'Download A.I Do planning backup',
        mimeType: 'application/json',
      });
      setExportMessage('Backup is ready in the share sheet.');
      return;
    }

    setExportMessage(`Backup saved to ${fileUri}.`);
  }

  return (
    <Screen>
      <SectionHeader subtitle="Notification delivery, RSVP emails, Aria memory, privacy, backups, and account controls." title="Settings" />

      <Card style={styles.cardGap}>
        <SettingsRow
          icon="mail-outline"
          label="Email reminders"
          meta="Receive email notifications for upcoming task deadlines."
          right={
            <Switch
              onValueChange={(enabled) => updateSettings({ emailRemindersEnabled: enabled })}
              thumbColor={colors.cardStrong}
              trackColor={{ false: colors.primarySoft, true: colors.primary }}
              value={data.settings.emailRemindersEnabled}
            />
          }
        />
        <View style={styles.choiceBlock}>
          <Text style={[styles.choiceLabel, { color: colors.text }]}>Remind me before deadline</Text>
          <View style={styles.choiceRow}>
            {reminderChoices.map((days) => (
              <FilterPill
                active={data.settings.deadlineReminderDays === days}
                key={days}
                label={`${days} day${days === 1 ? '' : 's'}`}
                onPress={() => updateSettings({ deadlineReminderDays: days })}
              />
            ))}
          </View>
          <Text style={[styles.helper, { color: colors.muted }]}>
            In-app notifications stay available through the bell and app alerts.
          </Text>
        </View>
      </Card>

      <Card style={styles.cardGap}>
        <SettingsRow
          icon="chatbox-ellipses-outline"
          label="RSVP response emails"
          meta="Keep this on to receive RSVP copies by email. Add planner or partner emails below."
          right={
            <Switch
              onValueChange={(enabled) => updateSettings({ rsvpEmailForwardingEnabled: enabled })}
              thumbColor={colors.cardStrong}
              trackColor={{ false: colors.primarySoft, true: colors.primary }}
              value={data.settings.rsvpEmailForwardingEnabled}
            />
          }
        />
        <FormField
          keyboardType="email-address"
          label="Add response email"
          onChangeText={setEmailDraft}
          placeholder="planner@example.com"
          value={emailDraft}
        />
        <PrimaryButton icon="add" label="Add Email" onPress={saveEmail} />
        <View style={styles.emailList}>
          {data.settings.rsvpResponseEmails.map((email) => (
            <View key={email} style={[styles.emailPill, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.emailText, { color: colors.text }]}>{email}</Text>
              <Pressable accessibilityLabel={`Remove ${email}`} onPress={() => removeRsvpResponseEmail(email)}>
                <Ionicons color={colors.primary} name="close-circle" size={20} />
              </Pressable>
            </View>
          ))}
        </View>
      </Card>

      <Card style={styles.cardGap}>
        <View style={styles.sectionTop}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
            <MaterialCommunityIcons color={colors.primary} name="star-four-points-outline" size={24} />
          </View>
          <View style={styles.sectionCopy}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Things Aria should know</Text>
            <Text style={[styles.helper, { color: colors.muted }]}>
              Aria uses these notes when drafting emails, spotting risks, and guiding planning decisions.
            </Text>
          </View>
        </View>
        <FormField
          label="Aria memory"
          multiline
          onChangeText={setAriaMemory}
          placeholder="Theme, allergies, traditions, family dynamics, must-haves..."
          value={ariaMemory}
        />
        <PrimaryButton icon="save-outline" label={savedMemory ? 'Saved' : 'Save Aria Notes'} onPress={saveAriaMemory} variant="gold" />
      </Card>

      <Card style={styles.cardGap}>
        <SettingsRow
          icon="color-palette-outline"
          label="Theme"
          meta={mode === 'light' ? 'Cream, blush, and gold' : 'Evening blush and gold'}
          right={
            <View style={styles.themeButtons}>
              <PrimaryButton label="Light" onPress={() => setMode('light')} variant={mode === 'light' ? 'primary' : 'ghost'} />
              <PrimaryButton label="Dark" onPress={() => setMode('dark')} variant={mode === 'dark' ? 'primary' : 'ghost'} />
            </View>
          }
        />
      </Card>

      <Card style={styles.cardGap}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Data</Text>
        <Text style={[styles.helper, { color: colors.muted }]}>Download a complete backup of your wedding planning data.</Text>
        <PrimaryButton icon="download-outline" label="Download My Data" onPress={downloadData} />
        {exportMessage ? <Text style={[styles.helper, { color: colors.muted }]}>{exportMessage}</Text> : null}
        {data.settings.dataExportRequestedAt ? (
          <Text style={[styles.helper, { color: colors.muted }]}>
            Last requested {new Date(data.settings.dataExportRequestedAt).toLocaleString()}.
          </Text>
        ) : null}
      </Card>

      <Card style={styles.cardGap}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Activity Log</Text>
        <Text style={[styles.helper, { color: colors.muted }]}>Recent changes to your wedding data.</Text>
        {data.activityLog.slice(0, 8).map((entry) => (
          <View key={entry.id} style={[styles.activityRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.activityIcon, { backgroundColor: colorForTone(entry.tone, colors) }]}>
              <Ionicons color={colors.text} name={iconForTone(entry.tone)} size={15} />
            </View>
            <View style={styles.activityCopy}>
              <Text style={[styles.activityTitle, { color: colors.text }]}>{entry.action}</Text>
              <Text style={[styles.activityDetail, { color: colors.muted }]}>{entry.detail}</Text>
              <Text style={[styles.activityDate, { color: colors.muted }]}>{new Date(entry.createdAt).toLocaleString()}</Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function SettingsRow({
  icon,
  label,
  meta,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  meta: string;
  right: React.ReactNode;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.settingsRow}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons color={colors.primary} name={icon} size={22} />
      </View>
      <View style={styles.settingCopy}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.helper, { color: colors.muted }]}>{meta}</Text>
      </View>
      {right}
    </View>
  );
}

function colorForTone(tone: 'create' | 'update' | 'delete' | 'sync', colors: ReturnType<typeof useAppTheme>['colors']) {
  if (tone === 'create') return 'rgba(141, 148, 106, 0.24)';
  if (tone === 'delete') return 'rgba(215, 129, 132, 0.24)';
  if (tone === 'sync') return colors.accentSoft;
  return colors.primarySoft;
}

function iconForTone(tone: 'create' | 'update' | 'delete' | 'sync'): keyof typeof Ionicons.glyphMap {
  if (tone === 'create') return 'add';
  if (tone === 'delete') return 'trash-outline';
  if (tone === 'sync') return 'download-outline';
  return 'create-outline';
}

const styles = StyleSheet.create({
  activityCopy: {
    flex: 1,
  },
  activityDate: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 4,
  },
  activityDetail: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  activityIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  activityRow: {
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  activityTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  cardGap: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  choiceBlock: {
    gap: spacing.sm,
  },
  choiceLabel: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emailList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emailPill: {
    alignItems: 'center',
    borderRadius: radii.xl,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emailText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  helper: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
  },
  sectionTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  settingCopy: {
    flex: 1,
  },
  settingLabel: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  settingsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  themeButtons: {
    gap: spacing.xs,
  },
});
