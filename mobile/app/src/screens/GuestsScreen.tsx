import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { FilterPill } from '../components/FilterPill';
import { FormField } from '../components/FormField';
import { FormSheet } from '../components/FormSheet';
import { InvitationThumb } from '../components/InvitationThumb';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { SearchBar } from '../components/SearchBar';
import { SectionHeader } from '../components/SectionHeader';
import { StatusPill } from '../components/StatusPill';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, spacing, useAppTheme } from '../theme';
import { RsvpStatus } from '../types';

type GuestFilter = 'All' | RsvpStatus;

const filters: GuestFilter[] = ['All', 'Confirmed', 'Pending', 'Declined'];

export function GuestsScreen() {
  const { colors } = useAppTheme();
  const { addGuest, data, loading, refresh, sendGuestReminder, updateGuest, updateRsvp } = usePlanningData();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GuestFilter>('All');
  const [guestSheetOpen, setGuestSheetOpen] = useState(false);
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [guestForm, setGuestForm] = useState({
    mealPreference: '',
    name: '',
    role: '',
    rsvp: 'Pending' as RsvpStatus,
    table: '',
  });
  const confirmed = data.guests.filter((guest) => guest.rsvp === 'Confirmed').length;
  const pending = data.guests.filter((guest) => guest.rsvp === 'Pending').length;
  const declined = data.guests.filter((guest) => guest.rsvp === 'Declined').length;
  const progress = data.guests.length ? (confirmed / data.guests.length) * 100 : 0;

  const guests = useMemo(
    () =>
      data.guests.filter((guest) => {
        const matchesFilter = filter === 'All' || guest.rsvp === filter;
        const matchesQuery = guest.name.toLowerCase().includes(query.trim().toLowerCase());
        return matchesFilter && matchesQuery;
      }),
    [data.guests, filter, query],
  );

  function openGuestForm(guestId?: string) {
    const guest = data.guests.find((item) => item.id === guestId);
    setEditingGuestId(guest?.id ?? null);
    setGuestForm({
      mealPreference: guest?.mealPreference ?? '',
      name: guest?.name ?? '',
      role: guest?.role ?? 'Guest',
      rsvp: guest?.rsvp ?? 'Pending',
      table: guest?.table ?? '',
    });
    setGuestSheetOpen(true);
  }

  function setGuestField(key: keyof typeof guestForm, value: string) {
    setGuestForm((current) => ({ ...current, [key]: value }));
  }

  function saveGuest() {
    if (!guestForm.name.trim()) {
      return;
    }

    const nextGuest = {
      invitationStyle: 'floral' as const,
      mealPreference: guestForm.mealPreference.trim() || 'Guest',
      name: guestForm.name.trim(),
      role: guestForm.role.trim() || 'Guest',
      rsvp: guestForm.rsvp,
      table: guestForm.table.trim() || 'Unassigned',
    };

    if (editingGuestId) {
      updateGuest(editingGuestId, nextGuest);
    } else {
      addGuest(nextGuest);
    }

    setGuestSheetOpen(false);
  }

  return (
    <Screen onRefresh={refresh} refreshing={loading}>
      <SectionHeader centered subtitle="Track RSVP status, meal preferences, tables, and reminders." title="Guest List & Invitations" />

      <Card style={styles.quickAddCard}>
        <View style={styles.quickAddCopy}>
          <Text style={[styles.quickAddTitle, { color: colors.text }]}>Guest Operations</Text>
          <Text style={[styles.quickAddMeta, { color: colors.muted }]}>Add guests, edit meals, assign tables, and nudge pending RSVPs.</Text>
        </View>
        <PrimaryButton icon="person-add-outline" label="Add Guest" onPress={() => openGuestForm()} />
      </Card>

      <Card padding={spacing.md} style={styles.summaryCard}>
        <SummaryItem icon="file-document-multiple-outline" label="Total Guests" value={data.guests.length.toString()} />
        <SummaryItem icon="heart-circle" label="Confirmed" value={confirmed.toString()} />
        <SummaryItem icon="table-furniture" label="Pending" value={pending.toString()} />
        <SummaryItem icon="close-circle-outline" label="Declined" value={declined.toString()} />
      </Card>

      <ProgressBar value={progress} />

      <View style={styles.searchWrap}>
        <SearchBar onChangeText={setQuery} placeholder="Search Guests" value={query} />
      </View>

      <View style={styles.filters}>
        {filters.map((item) => (
          <FilterPill active={filter === item} key={item} label={item} onPress={() => setFilter(item)} />
        ))}
      </View>

      {guests.map((guest) => (
        <Card key={guest.id} padding={0} style={styles.guestCard}>
          <View style={styles.guestBody}>
            <InvitationThumb styleName={guest.invitationStyle} />
            <View style={styles.guestCopy}>
              <Text style={[styles.guestName, { color: colors.text }]}>{guest.name}</Text>
              <Text style={[styles.guestMeta, { color: colors.muted }]}>
                {guest.mealPreference} - {guest.table}
              </Text>
            </View>
            <Pressable onPress={() => updateRsvp(guest.id, guest.rsvp === 'Confirmed' ? 'Pending' : 'Confirmed')}>
              <StatusPill status={guest.rsvp} />
            </Pressable>
          </View>
          <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
            {guest.rsvp === 'Declined' ? (
              <>
                <PrimaryButton icon="archive-outline" label="Archive" variant="ghost" />
                <PrimaryButton icon="arrow-undo-outline" label="Undo" onPress={() => updateRsvp(guest.id, 'Pending')} variant="ghost" />
              </>
            ) : (
              <>
                <PrimaryButton
                  icon={guest.rsvp === 'Pending' ? 'notifications-outline' : 'eye-outline'}
                  label={guest.rsvp === 'Pending' ? 'Send Reminder' : 'View RSVP'}
                  onPress={() => (guest.rsvp === 'Pending' ? sendGuestReminder(guest.id) : openGuestForm(guest.id))}
                  variant="ghost"
                />
                <PrimaryButton icon="create-outline" label={guest.rsvp === 'Confirmed' ? 'Edit Meal' : 'Edit Details'} onPress={() => openGuestForm(guest.id)} variant="ghost" />
              </>
            )}
          </View>
        </Card>
      ))}

      <FormSheet
        onClose={() => setGuestSheetOpen(false)}
        subtitle="Update the details used by invitations, RSVP tracking, seating, meals, and reminders."
        title={editingGuestId ? 'Edit Guest' : 'Add Guest'}
        visible={guestSheetOpen}
      >
        <FormField label="Guest name" onChangeText={(value) => setGuestField('name', value)} placeholder="Emily Vargas" value={guestForm.name} />
        <FormField label="Role" onChangeText={(value) => setGuestField('role', value)} placeholder="Guest, Family, Wedding Party" value={guestForm.role} />
        <FormField label="Meal preference" onChangeText={(value) => setGuestField('mealPreference', value)} placeholder="Chicken, vegetarian..." value={guestForm.mealPreference} />
        <FormField label="Table" onChangeText={(value) => setGuestField('table', value)} placeholder="Table 3" value={guestForm.table} />
        <View style={styles.rsvpChoices}>
          {(['Confirmed', 'Pending', 'Declined'] as RsvpStatus[]).map((status) => (
            <FilterPill active={guestForm.rsvp === status} key={status} label={status} onPress={() => setGuestForm((current) => ({ ...current, rsvp: status }))} />
          ))}
        </View>
        <PrimaryButton icon="checkmark-outline" label="Save Guest" onPress={saveGuest} />
      </FormSheet>
    </Screen>
  );
}

function SummaryItem({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.summaryItem}>
      <MaterialCommunityIcons color={colors.accent} name={icon} size={24} />
      <Text style={[styles.summaryLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: colors.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  quickAddCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  quickAddCopy: {
    flex: 1,
  },
  quickAddTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 22,
  },
  quickAddMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  summaryLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'center',
  },
  summaryValue: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
  },
  searchWrap: {
    marginTop: spacing.xl,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  guestCard: {
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  guestBody: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  guestCopy: {
    flex: 1,
  },
  guestName: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
  },
  guestMeta: {
    fontFamily: fonts.body,
    fontSize: 15,
    marginTop: 2,
  },
  actionRow: {
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
  },
  rsvpChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
