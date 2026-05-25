import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { FilterPill } from '../components/FilterPill';
import { FormField } from '../components/FormField';
import { FormSheet } from '../components/FormSheet';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';
import { WorkspaceInvite } from '../types';

export function WorkspaceScreen() {
  const { colors } = useAppTheme();
  const { addWorkspaceInvite, data } = usePlanningData();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'Planner' as WorkspaceInvite['role'] });

  function saveInvite() {
    if (!inviteForm.email.trim()) {
      return;
    }

    addWorkspaceInvite({ email: inviteForm.email.trim(), role: inviteForm.role });
    setInviteForm({ email: '', role: 'Planner' });
    setInviteOpen(false);
  }

  return (
    <Screen>
      <SectionHeader subtitle="Shared workspace, collaborators, planner access, family access, and pending invites." title="Workspace" />

      <Card style={styles.workspaceCard}>
        <View style={[styles.workspaceIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name="people-outline" size={28} />
        </View>
        <View style={styles.workspaceCopy}>
          <Text style={[styles.workspaceTitle, { color: colors.text }]}>{data.profile.coupleName}</Text>
          <Text style={[styles.workspaceMeta, { color: colors.muted }]}>Owner workspace - wedding planning OS</Text>
        </View>
        <PrimaryButton icon="person-add-outline" label="Invite" onPress={() => setInviteOpen(true)} />
      </Card>

      {data.workspaceInvites.map((invite) => (
        <Card key={invite.id} style={styles.inviteCard}>
          <View style={[styles.inviteIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons color={colors.primary} name="mail-outline" size={22} />
          </View>
          <View style={styles.inviteCopy}>
            <Text style={[styles.email, { color: colors.text }]}>{invite.email}</Text>
            <Text style={[styles.role, { color: colors.muted }]}>{invite.role} - {invite.status}</Text>
          </View>
          <Ionicons color={invite.status === 'Accepted' ? colors.success : colors.accent} name={invite.status === 'Accepted' ? 'checkmark-circle' : 'time-outline'} size={24} />
        </Card>
      ))}

      <FormSheet onClose={() => setInviteOpen(false)} subtitle="Invite partners, planners, family, or vendors into the wedding workspace." title="Invite Collaborator" visible={inviteOpen}>
        <FormField keyboardType="email-address" label="Email" onChangeText={(value) => setInviteForm((current) => ({ ...current, email: value }))} placeholder="planner@example.com" value={inviteForm.email} />
        <View style={styles.roleChoices}>
          {(['Planner', 'Partner', 'Family', 'Vendor'] as WorkspaceInvite['role'][]).map((role) => (
            <FilterPill active={inviteForm.role === role} key={role} label={role} onPress={() => setInviteForm((current) => ({ ...current, role }))} />
          ))}
        </View>
        <PrimaryButton icon="person-add-outline" label="Send Invite" onPress={saveInvite} />
      </FormSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  workspaceCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  workspaceIcon: {
    alignItems: 'center',
    borderRadius: radii.lg,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  workspaceCopy: {
    flex: 1,
  },
  workspaceTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
  },
  workspaceMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  inviteCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  inviteIcon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  inviteCopy: {
    flex: 1,
  },
  email: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  role: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  roleChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
