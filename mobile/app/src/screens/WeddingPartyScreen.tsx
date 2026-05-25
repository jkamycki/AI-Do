import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';

export function WeddingPartyScreen() {
  const { colors } = useAppTheme();
  const { data, respondAsAria } = usePlanningData();

  return (
    <Screen>
      <SectionHeader subtitle="Track attendants, attire, duties, phone numbers, and ceremony roles." title="Wedding Party" />

      {data.weddingParty.map((member) => (
        <Card key={member.id} style={styles.memberCard}>
          <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{member.name.split(' ').map((part) => part[0]).join('')}</Text>
          </View>
          <View style={styles.copy}>
            <View style={styles.header}>
              <View>
                <Text style={[styles.name, { color: colors.text }]}>{member.name}</Text>
                <Text style={[styles.role, { color: colors.muted }]}>{member.role} - {member.side}</Text>
              </View>
              <Text style={[styles.status, { backgroundColor: colors.accentSoft, color: colors.text }]}>{member.attireStatus}</Text>
            </View>
            <Text style={[styles.phone, { color: colors.muted }]}>{member.phone}</Text>
            <View style={styles.tasks}>
              {member.tasks.map((task) => (
                <View key={task} style={[styles.taskPill, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons color={colors.primary} name="checkmark-circle-outline" size={14} />
                  <Text style={[styles.taskText, { color: colors.text }]}>{task}</Text>
                </View>
              ))}
            </View>
            <View style={styles.actions}>
              <PrimaryButton icon="chatbubble-outline" label="Message" onPress={() => respondAsAria(`Draft a message to ${member.name}`)} variant="ghost" />
              <PrimaryButton icon="create-outline" label="Edit Duties" onPress={() => respondAsAria(`Review duties for ${member.name}`)} variant="ghost" />
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  memberCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 28,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 15,
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
  name: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
  },
  role: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  status: {
    borderRadius: radii.xl,
    fontFamily: fonts.semibold,
    fontSize: 11,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  phone: {
    fontFamily: fonts.medium,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  tasks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  taskPill: {
    alignItems: 'center',
    borderRadius: radii.xl,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  taskText: {
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
