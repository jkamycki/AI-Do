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
import { WeddingPartyMember } from '../types';

type PartyForm = {
  attireStatus: WeddingPartyMember['attireStatus'];
  id?: string;
  name: string;
  phone: string;
  role: string;
  side: WeddingPartyMember['side'];
  tasks: string;
};

const emptyForm: PartyForm = {
  attireStatus: 'Not Started',
  name: '',
  phone: '',
  role: '',
  side: 'Bride',
  tasks: '',
};

const sides: WeddingPartyMember['side'][] = ['Bride', 'Groom', 'Shared'];
const attireStatuses: WeddingPartyMember['attireStatus'][] = ['Not Started', 'In Progress', 'Complete'];

export function WeddingPartyScreen() {
  const { colors } = useAppTheme();
  const { addWeddingPartyMember, data, deleteWeddingPartyMember, respondAsAria, updateWeddingPartyMember } = usePlanningData();
  const [form, setForm] = useState<PartyForm>(emptyForm);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formError, setFormError] = useState('');

  function openAddSheet() {
    setForm(emptyForm);
    setFormError('');
    setSheetOpen(true);
  }

  function openEditSheet(member: WeddingPartyMember) {
    setForm({
      attireStatus: member.attireStatus,
      id: member.id,
      name: member.name,
      phone: member.phone,
      role: member.role,
      side: member.side,
      tasks: member.tasks.join(', '),
    });
    setFormError('');
    setSheetOpen(true);
  }

  function setField<K extends keyof PartyForm>(key: K, value: PartyForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function closeSheet() {
    setSheetOpen(false);
    setForm(emptyForm);
    setFormError('');
  }

  function saveMember() {
    const name = form.name.trim();
    const role = form.role.trim();
    if (!name || !role) {
      setFormError('Add a name and role.');
      return;
    }

    const member = {
      attireStatus: form.attireStatus,
      name,
      phone: form.phone.trim(),
      role,
      side: form.side,
      tasks: form.tasks.split(',').map((task) => task.trim()).filter(Boolean),
    };

    if (form.id) {
      updateWeddingPartyMember(form.id, member);
    } else {
      addWeddingPartyMember(member);
    }
    closeSheet();
  }

  return (
    <Screen>
      <SectionHeader subtitle="Track attendants, phone numbers, ceremony roles, and day-of responsibilities." title="Wedding Party" />

      <Card style={styles.summaryCard}>
        <View style={[styles.summaryIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name="people-outline" size={25} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>{data.weddingParty.length} people</Text>
          <Text style={[styles.summaryText, { color: colors.muted }]}>Keep roles, phone numbers, attire status, and duty notes synced with your website portal.</Text>
        </View>
        <PrimaryButton icon="person-add-outline" label="Add" onPress={openAddSheet} />
      </Card>

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
              <Text style={[styles.status, { backgroundColor: colors.accentSoft, color: colors.text }]}>{member.tasks.length} task{member.tasks.length === 1 ? '' : 's'}</Text>
            </View>
            <Text style={[styles.phone, { color: colors.muted }]}>{member.phone}</Text>
            <Text style={[styles.attire, { color: colors.muted }]}>Attire: {member.attireStatus}</Text>
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
              <PrimaryButton icon="create-outline" label="Edit" onPress={() => openEditSheet(member)} variant="ghost" />
              <PrimaryButton icon="trash-outline" label="Remove" onPress={() => deleteWeddingPartyMember(member.id)} variant="ghost" />
            </View>
          </View>
        </Card>
      ))}

      <FormSheet
        onClose={closeSheet}
        subtitle="Save roles, contact details, attire status, and comma-separated duties."
        title={form.id ? 'Edit Wedding Party' : 'Add Wedding Party'}
        visible={sheetOpen}
      >
        {formError ? <Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text> : null}
        <FormField label="Name" onChangeText={(value) => setField('name', value)} placeholder="Maid of Honor" value={form.name} />
        <FormField label="Role" onChangeText={(value) => setField('role', value)} placeholder="Maid of Honor, Best Man, Officiant..." value={form.role} />
        <FormField label="Phone" onChangeText={(value) => setField('phone', value)} placeholder="(555) 000-0000" value={form.phone} />
        <View style={styles.choiceGroup}>
          <Text style={[styles.choiceLabel, { color: colors.muted }]}>Side</Text>
          <View style={styles.choiceRow}>
            {sides.map((side) => (
              <FilterPill active={form.side === side} key={side} label={side} onPress={() => setField('side', side)} />
            ))}
          </View>
        </View>
        <View style={styles.choiceGroup}>
          <Text style={[styles.choiceLabel, { color: colors.muted }]}>Attire</Text>
          <View style={styles.choiceRow}>
            {attireStatuses.map((status) => (
              <FilterPill active={form.attireStatus === status} key={status} label={status} onPress={() => setField('attireStatus', status)} />
            ))}
          </View>
        </View>
        <FormField multiline label="Duties" onChangeText={(value) => setField('tasks', value)} placeholder="Toast draft, ring handoff, photo list..." value={form.tasks} />
        <PrimaryButton icon="checkmark-outline" label={form.id ? 'Save Changes' : 'Add Member'} onPress={saveMember} />
      </FormSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryIcon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  summaryTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 22,
  },
  summaryText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
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
  attire: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
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
  choiceGroup: {
    gap: spacing.xs,
  },
  choiceLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  errorText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
});
