import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Linking, Share, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { FilterPill } from '../components/FilterPill';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';
import { slugifyCoupleName } from '../utils/format';

export function WebsiteEditorScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { data, updateGuestPhotoDropSettings, updateWebsiteSectionStatus } = usePlanningData();
  const ready = data.websiteSections.filter((section) => section.status !== 'Draft').length;
  const coupleSlug = slugifyCoupleName(data.profile.coupleName);
  const websiteUrl = `https://aidowedding.net/${coupleSlug}`;
  const rsvpUrl = `https://aidowedding.net/${coupleSlug}/rsvp`;
  const selectedQrUrl = data.guestPhotoDrop.selectedQrTarget === 'rsvp' ? rsvpUrl : websiteUrl;
  const approvedGuestUploads = data.guestPhotoUploads.filter((upload) => upload.status === 'Approved').length;

  function publishAll() {
    data.websiteSections.forEach((section) => updateWebsiteSectionStatus(section.id, 'Published'));
  }

  function openPreview() {
    void Linking.openURL(websiteUrl).catch(() => undefined);
  }

  function shareWebsite() {
    void Share.share({
      message: `View our wedding website: ${websiteUrl}`,
      url: websiteUrl,
    });
  }

  return (
    <Screen>
      <SectionHeader subtitle="Guest-facing website, RSVP flow, travel details, registry, privacy, and publishing." title="Website Control" />

      <Card style={styles.previewCard}>
        <View>
          <Text style={[styles.previewEyebrow, { color: colors.primary }]}>Public Site</Text>
          <Text style={[styles.previewTitle, { color: colors.text }]}>{data.profile.coupleName}</Text>
          <Text style={[styles.previewMeta, { color: colors.muted }]}>{websiteUrl}</Text>
        </View>
        <ProgressBar value={(ready / data.websiteSections.length) * 100} />
        <View style={styles.actions}>
          <PrimaryButton icon="eye-outline" label="Preview" onPress={openPreview} variant="ghost" />
          <PrimaryButton icon="share-outline" label="Share" onPress={shareWebsite} variant="ghost" />
          <PrimaryButton icon="cloud-upload-outline" label="Publish" onPress={publishAll} />
        </View>
      </Card>

      <Card style={styles.desktopNotice}>
        <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
          <Ionicons color={colors.accent} name="desktop-outline" size={22} />
        </View>
        <View style={styles.sectionCopy}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Full design studio lives on desktop</Text>
          <Text style={[styles.sectionDesc, { color: colors.muted }]}>
            Use the app for preview, publishing, quick section visibility, Photo Drop, and sharing. Use A.I DO on desktop for themes, templates, drag-and-drop order, and detailed layout polish.
          </Text>
        </View>
      </Card>

      <Card style={styles.qrCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
            <Ionicons color={colors.primary} name="qr-code-outline" size={22} />
          </View>
          <View style={styles.sectionCopy}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Guest QR Codes</Text>
            <Text style={[styles.sectionDesc, { color: colors.muted }]}>Choose one QR purpose at a time so invitations and signage stay clear.</Text>
          </View>
        </View>
        <View style={styles.choiceRow}>
          <FilterPill
            active={data.guestPhotoDrop.selectedQrTarget === 'website'}
            label="Website home"
            onPress={() => updateGuestPhotoDropSettings({ selectedQrTarget: 'website' })}
          />
          <FilterPill
            active={data.guestPhotoDrop.selectedQrTarget === 'rsvp'}
            label="RSVP section"
            onPress={() => updateGuestPhotoDropSettings({ selectedQrTarget: 'rsvp' })}
          />
        </View>
        <View style={[styles.linkBox, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name="globe-outline" size={18} />
          <Text style={[styles.linkText, { color: colors.text }]}>{selectedQrUrl}</Text>
          <Ionicons color={colors.accent} name="qr-code-outline" size={20} />
        </View>
        <Text style={[styles.sectionDesc, { color: colors.muted }]}>
          {data.guestPhotoDrop.selectedQrTarget === 'rsvp'
            ? 'Use this QR on invitations and response reminders. Guests land directly where they can RSVP.'
            : 'Use this QR on signs, detail cards, and general guest sharing. Guests land on the wedding website home page.'}
        </Text>
      </Card>

      <Card style={styles.photoDropCard}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name="camera-outline" size={22} />
        </View>
        <View style={styles.sectionCopy}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Guest Photo Drop</Text>
          <Text style={[styles.sectionDesc, { color: colors.muted }]}>
            QR upload page, captions, approval queue, download controls, and portal/website display settings. Approved website photos appear in Gallery under Guest Uploads.
          </Text>
        </View>
        <PrimaryButton icon="arrow-forward" label="Open" onPress={() => navigation.navigate('GuestPhotoDrop')} />
      </Card>

      <Card style={styles.uploadsCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
            <Ionicons color={colors.accent} name="images-outline" size={22} />
          </View>
          <View style={styles.sectionCopy}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Guest Uploads Gallery</Text>
            <Text style={[styles.sectionDesc, { color: colors.muted }]}>
              {approvedGuestUploads} approved upload{approvedGuestUploads === 1 ? '' : 's'} ready for the portal
              {data.guestPhotoDrop.displayMode === 'portal' ? '.' : ' and published wedding website.'}
            </Text>
          </View>
        </View>
      </Card>

      {data.websiteSections.map((section) => (
        <Card key={section.id} style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
              <Ionicons color={colors.primary} name={section.status === 'Published' ? 'globe-outline' : 'create-outline'} size={22} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
              <Text style={[styles.sectionDesc, { color: colors.muted }]}>{section.description}</Text>
            </View>
            <Text style={[styles.status, { backgroundColor: section.status === 'Draft' ? colors.accentSoft : colors.primarySoft, color: colors.text }]}>
              {section.status}
            </Text>
          </View>
          <View style={styles.sectionActions}>
            <PrimaryButton icon="create-outline" label="Draft" onPress={() => updateWebsiteSectionStatus(section.id, 'Draft')} variant="ghost" />
            <PrimaryButton icon="checkmark-outline" label="Ready" onPress={() => updateWebsiteSectionStatus(section.id, 'Ready')} variant="ghost" />
            <PrimaryButton icon="globe-outline" label="Publish" onPress={() => updateWebsiteSectionStatus(section.id, 'Published')} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  photoDropCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  desktopNotice: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  previewEyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  previewTitle: {
    fontFamily: fonts.heading,
    fontSize: 34,
  },
  previewMeta: {
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  linkBox: {
    alignItems: 'center',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  linkText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  qrCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionCard: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
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
    fontSize: 22,
  },
  sectionDesc: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  status: {
    borderRadius: radii.xl,
    fontFamily: fonts.semibold,
    fontSize: 11,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sectionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  uploadsCard: {
    marginBottom: spacing.lg,
  },
});
