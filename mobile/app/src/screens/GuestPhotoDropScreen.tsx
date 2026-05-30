import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { FilterPill } from '../components/FilterPill';
import { FormField } from '../components/FormField';
import { MetricCard } from '../components/MetricCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { StatusPill } from '../components/StatusPill';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';
import { GuestPhotoDisplayMode } from '../types';
import { slugifyCoupleName } from '../utils/format';

const destinationCopy: Record<GuestPhotoDisplayMode, { label: string; detail: string; preview: string }> = {
  portal: {
    label: 'Portal only',
    detail: 'Approved photos stay private inside A.I DO for the couple to review and download.',
    preview: 'Guests will not see the wedding website link after uploading.',
  },
  website: {
    label: 'Portal + website highlights',
    detail: 'All photos route to the portal first. Up to 50 approved favorites can also appear on the wedding website.',
    preview: 'Guests see the gallery link, while every upload remains managed in the portal.',
  },
  both: {
    label: 'Portal + website highlights',
    detail: 'All photos route to the portal first. Up to 50 approved favorites can also appear on the wedding website.',
    preview: 'Guests see the gallery link, while every upload remains managed in the portal.',
  },
};

function defaultInstructions(displayMode: GuestPhotoDisplayMode) {
  if (displayMode === 'portal') {
    return "Share your favorite wedding day moments here. Add a caption if you'd like, and the couple will review every photo privately.";
  }

  return "Share your favorite wedding day moments here. Add a caption if you'd like, and once approved they may appear in the couple's gallery.";
}

export function GuestPhotoDropScreen() {
  const { colors } = useAppTheme();
  const { data, updateGuestPhotoDropSettings, updateGuestPhotoUploadStatus } = usePlanningData();
  const settings = data.guestPhotoDrop;
  const [title, setTitle] = useState(settings.title);
  const [instructions, setInstructions] = useState(settings.instructions);
  const pending = data.guestPhotoUploads.filter((upload) => upload.status === 'Pending').length;
  const approved = data.guestPhotoUploads.filter((upload) => upload.status === 'Approved').length;
  const displayMode = settings.displayMode === 'website' ? 'both' : settings.displayMode;
  const websiteEnabled = displayMode === 'both';
  const coupleSlug = slugifyCoupleName(data.profile.coupleName);
  const publicUrl = `aidowedding.net/wedding/${coupleSlug}/disposable`;
  const weddingUrl = `aidowedding.net/w/${coupleSlug}`;

  function setDestination(displayMode: GuestPhotoDisplayMode) {
    const shouldReplaceInstructions = !instructions.trim() || instructions.toLowerCase().includes('website') || instructions.toLowerCase().includes('gallery');
    const nextInstructions = shouldReplaceInstructions ? defaultInstructions(displayMode) : instructions;
    setInstructions(nextInstructions);
    updateGuestPhotoDropSettings({
      displayMode,
      instructions: nextInstructions,
    });
  }

  function saveCopy() {
    updateGuestPhotoDropSettings({
      instructions: instructions.trim() || defaultInstructions(displayMode),
      title: title.trim() || 'Guest Photo Drop',
    });
  }

  function generateCopy() {
    const generated =
      displayMode === 'portal'
        ? 'Add your favorite wedding day photos here. The couple will review everything privately and save the memories they love most.'
        : 'Add your favorite wedding day photos here. After the couple approves them, your memories may appear in the wedding gallery.';
    setInstructions(generated);
    updateGuestPhotoDropSettings({ instructions: generated });
  }

  return (
    <Screen>
      <SectionHeader
        subtitle="Turn guests' phones into disposable cameras with QR access, film effects, locked rolls, and portal review."
        title="Guest Photo Drop"
      />

      <View style={styles.metricRow}>
        <MetricCard icon="camera-plus-outline" label="Pending" value={String(pending)} />
        <MetricCard icon="image-check-outline" label="Approved" value={String(approved)} />
      </View>

      <Card style={styles.heroCard}>
        <View style={[styles.heroIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name="camera-outline" size={30} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Disposable camera</Text>
          <Text style={[styles.heroText, { color: colors.muted }]}>Guests scan your QR code, pick a film effect, take a locked roll of shots, then upload everything to your portal for approval.</Text>
        </View>
        <Switch
          onValueChange={(enabled) => updateGuestPhotoDropSettings({ enabled })}
          thumbColor={colors.cardStrong}
          trackColor={{ false: colors.primarySoft, true: colors.primary }}
          value={settings.enabled}
        />
      </Card>

      <Card style={styles.qrCard}>
        <View style={styles.qrTop}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Print-ready QR</Text>
            <Text style={[styles.helper, { color: colors.muted }]}>Use this for signs, invitations, or a card at the reception so guests can open the disposable camera.</Text>
          </View>
          <View style={[styles.qrBox, { borderColor: colors.border, backgroundColor: colors.cardStrong }]}>
            <MaterialCommunityIcons color={colors.primary} name="qrcode" size={58} />
          </View>
        </View>
        <Text style={[styles.qrUrl, { backgroundColor: colors.primarySoft, color: colors.text }]}>{publicUrl}</Text>
        <Text style={[styles.helper, { color: colors.muted }]}>
          This QR always opens the disposable camera page. Shared links open the same camera experience as the QR code.
        </Text>
      </Card>

      <Card style={styles.cardGap}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Photo routing</Text>
        <View style={styles.choiceRow}>
          {(['portal', 'both'] as GuestPhotoDisplayMode[]).map((mode) => (
            <FilterPill active={displayMode === mode} key={mode} label={destinationCopy[mode].label} onPress={() => setDestination(mode)} />
          ))}
        </View>
        <Text style={[styles.helper, { color: colors.muted }]}>{destinationCopy[displayMode].detail}</Text>
        <View style={[styles.previewNote, { backgroundColor: colors.cardStrong, borderColor: colors.border }]}>
          <Ionicons color={websiteEnabled ? colors.accent : colors.primary} name={websiteEnabled ? 'globe-outline' : 'lock-closed-outline'} size={20} />
          <Text style={[styles.previewText, { color: colors.text }]}>
            {destinationCopy[displayMode].preview}
            {websiteEnabled ? ` Gallery link shown after upload: ${weddingUrl}` : ''}
          </Text>
        </View>
      </Card>

      <Card style={styles.cardGap}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Guest-facing copy</Text>
        <FormField label="Public page title" onChangeText={setTitle} value={title} />
        <FormField label="Guest instructions" multiline onChangeText={setInstructions} value={instructions} />
        <View style={styles.actions}>
          <PrimaryButton icon="sparkles-outline" label="Generate" onPress={generateCopy} variant="gold" />
          <PrimaryButton icon="refresh-outline" label="Reset" onPress={() => setInstructions(defaultInstructions(displayMode))} variant="ghost" />
          <PrimaryButton icon="save-outline" label="Save" onPress={saveCopy} />
        </View>
      </Card>

      <Card style={styles.cardGap}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Disposable roll size</Text>
        <Text style={[styles.helper, { color: colors.muted }]}>Choose how many locked shots each phone can take before uploading the roll.</Text>
        <View style={styles.choiceRow}>
          {[5, 10].map((limit) => (
            <FilterPill
              active={settings.maxUploads === limit}
              key={limit}
              label={`${limit} photos`}
              onPress={() => updateGuestPhotoDropSettings({ maxUploads: limit })}
            />
          ))}
        </View>
      </Card>

      <Text style={[styles.queueTitle, { color: colors.text }]}>Approval Queue</Text>
      {data.guestPhotoUploads.map((upload) => (
        <Card key={upload.id} style={styles.uploadCard}>
          <View style={styles.uploadHeader}>
            <View style={[styles.thumbnail, { backgroundColor: colors.primarySoft }]}>
              <Ionicons color={colors.primary} name="images-outline" size={24} />
            </View>
            <View style={styles.uploadCopy}>
              <Text style={[styles.uploadName, { color: colors.text }]}>{upload.guestName}</Text>
              <Text style={[styles.uploadMeta, { color: colors.muted }]}>
                {upload.photoCount} photo{upload.photoCount === 1 ? '' : 's'} - {new Date(upload.uploadedAt).toLocaleString()}
              </Text>
            </View>
            <StatusPill status={upload.status} />
          </View>
          <Text style={[styles.caption, { color: colors.muted }]}>{upload.caption || 'No caption added.'}</Text>
          <View style={styles.actions}>
            <PrimaryButton icon="checkmark-outline" label="Approve" onPress={() => updateGuestPhotoUploadStatus(upload.id, 'Approved')} />
            <PrimaryButton icon="eye-off-outline" label="Hide" onPress={() => updateGuestPhotoUploadStatus(upload.id, 'Hidden')} variant="ghost" />
            <PrimaryButton icon="download-outline" label="Download" variant="gold" />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  cardGap: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  helper: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  heroCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  heroCopy: {
    flex: 1,
  },
  heroIcon: {
    alignItems: 'center',
    borderRadius: radii.lg,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  heroText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  heroTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 22,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  previewNote: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  previewText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  qrBox: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  qrCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  qrTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  qrUrl: {
    borderRadius: radii.md,
    fontFamily: fonts.semibold,
    fontSize: 13,
    overflow: 'hidden',
    padding: spacing.md,
  },
  queueTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 25,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 23,
  },
  thumbnail: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  uploadCard: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  uploadCopy: {
    flex: 1,
  },
  uploadHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  uploadMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  uploadName: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
});
