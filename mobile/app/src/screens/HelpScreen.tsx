import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';

export function HelpScreen() {
  const { colors } = useAppTheme();
  const { data, respondAsAria } = usePlanningData();

  return (
    <Screen>
      <SectionHeader subtitle="Support, guides, feedback, contact forms, privacy, terms, security, and data handling." title="Help" />

      <Card style={styles.supportCard}>
        <View style={[styles.supportIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name="chatbubbles-outline" size={28} />
        </View>
        <View style={styles.supportCopy}>
          <Text style={[styles.supportTitle, { color: colors.text }]}>Need help?</Text>
          <Text style={[styles.supportText, { color: colors.muted }]}>Send a support ticket, share feedback, or review account and planning guidance.</Text>
        </View>
        <PrimaryButton icon="send-outline" label="Contact" onPress={() => respondAsAria('Help me contact A.I DO support')} />
      </Card>

      {data.helpResources.map((resource) => (
        <Card key={resource.id} style={styles.resourceCard}>
          <View style={[styles.resourceIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons color={colors.primary} name={resource.status === 'New' ? 'sparkles-outline' : 'book-outline'} size={22} />
          </View>
          <View style={styles.resourceCopy}>
            <View style={styles.resourceHeader}>
              <Text style={[styles.resourceTitle, { color: colors.text }]}>{resource.title}</Text>
              <Text style={[styles.resourceStatus, { color: colors.primary }]}>{resource.status}</Text>
            </View>
            <Text style={[styles.resourceDetail, { color: colors.muted }]}>{resource.detail}</Text>
          </View>
        </Card>
      ))}

      <View style={styles.legalGrid}>
        {['Terms', 'Privacy', 'Security', 'Data Handling'].map((item) => (
          <Card key={item} padding={spacing.md} style={styles.legalCard}>
            <Text style={[styles.legalText, { color: colors.text }]}>{item}</Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  supportCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  supportIcon: {
    alignItems: 'center',
    borderRadius: radii.lg,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  supportCopy: {
    flex: 1,
  },
  supportTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 23,
  },
  supportText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  resourceCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  resourceIcon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  resourceCopy: {
    flex: 1,
  },
  resourceHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  resourceTitle: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  resourceStatus: {
    fontFamily: fonts.bold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  resourceDetail: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  legalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  legalCard: {
    minWidth: '45%',
  },
  legalText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    textAlign: 'center',
  },
});
