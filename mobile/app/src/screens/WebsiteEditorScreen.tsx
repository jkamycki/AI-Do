import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';

export function WebsiteEditorScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { data, updateWebsiteSectionStatus } = usePlanningData();
  const ready = data.websiteSections.filter((section) => section.status !== 'Draft').length;

  function publishAll() {
    data.websiteSections.forEach((section) => updateWebsiteSectionStatus(section.id, 'Published'));
  }

  return (
    <Screen>
      <SectionHeader subtitle="Guest-facing website, RSVP flow, travel details, registry, privacy, and publishing." title="Website Editor" />

      <Card style={styles.previewCard}>
        <View>
          <Text style={[styles.previewEyebrow, { color: colors.primary }]}>Public Site</Text>
          <Text style={[styles.previewTitle, { color: colors.text }]}>{data.profile.coupleName}</Text>
          <Text style={[styles.previewMeta, { color: colors.muted }]}>aidowedding.net/w/stacy-rick</Text>
        </View>
        <ProgressBar value={(ready / data.websiteSections.length) * 100} />
        <View style={styles.actions}>
          <PrimaryButton icon="eye-outline" label="Preview" variant="ghost" />
          <PrimaryButton icon="cloud-upload-outline" label="Publish" onPress={publishAll} />
        </View>
      </Card>

      <Card style={styles.photoDropCard}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name="camera-outline" size={22} />
        </View>
        <View style={styles.sectionCopy}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Guest Photo Drop</Text>
          <Text style={[styles.sectionDesc, { color: colors.muted }]}>
            QR upload page, captions, approval queue, download controls, and portal/website display settings.
          </Text>
        </View>
        <PrimaryButton icon="arrow-forward" label="Open" onPress={() => navigation.navigate('GuestPhotoDrop')} />
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
});
