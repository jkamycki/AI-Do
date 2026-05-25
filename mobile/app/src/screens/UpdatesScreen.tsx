import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { fonts, radii, spacing, useAppTheme } from '../theme';

const updates = [
  { title: 'Native Mobile Shell', detail: 'Home, Vendors, Budget, Checklist, Guests, and More now use native app screens.', tag: 'New' },
  { title: 'Planning Workflows', detail: 'Day-of, contracts, seating, hotels, invitations, and workspace screens added for parity.', tag: 'Updated' },
  { title: 'Backend Sync Ready', detail: 'The app can fall back to sample data while mobile API endpoints and auth are connected.', tag: 'Guide' },
];

export function UpdatesScreen() {
  const { colors } = useAppTheme();

  return (
    <Screen>
      <SectionHeader subtitle="Product updates, improvements, release notes, and what changed in the mobile experience." title="Updates" />

      {updates.map((update) => (
        <Card key={update.title} style={styles.card}>
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons color={colors.primary} name="sparkles-outline" size={22} />
          </View>
          <View style={styles.copy}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>{update.title}</Text>
              <Text style={[styles.tag, { backgroundColor: colors.accentSoft, color: colors.text }]}>{update.tag}</Text>
            </View>
            <Text style={[styles.detail, { color: colors.muted }]}>{update.detail}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  icon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  copy: {
    flex: 1,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    fontFamily: fonts.headingSemi,
    fontSize: 22,
  },
  tag: {
    borderRadius: radii.xl,
    fontFamily: fonts.bold,
    fontSize: 11,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  detail: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
});
