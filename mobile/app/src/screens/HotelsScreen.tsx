import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { FormField } from '../components/FormField';
import { FormSheet } from '../components/FormSheet';
import { MetricCard } from '../components/MetricCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, spacing, useAppTheme } from '../theme';
import { formatCurrency, formatShortDate } from '../utils/format';

export function HotelsScreen() {
  const { colors } = useAppTheme();
  const { data, updateHotelBlock } = usePlanningData();
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [form, setForm] = useState({ roomsBooked: '', roomsTotal: '' });
  const booked = data.hotels.reduce((sum, hotel) => sum + hotel.roomsBooked, 0);
  const total = data.hotels.reduce((sum, hotel) => sum + hotel.roomsTotal, 0);
  const activeHotel = useMemo(() => data.hotels.find((hotel) => hotel.id === hotelId), [data.hotels, hotelId]);

  function openHotel(hotel: (typeof data.hotels)[number]) {
    setForm({ roomsBooked: String(hotel.roomsBooked), roomsTotal: String(hotel.roomsTotal) });
    setHotelId(hotel.id);
  }

  function saveHotel() {
    if (!hotelId) {
      return;
    }

    updateHotelBlock(hotelId, {
      roomsBooked: Number.parseInt(form.roomsBooked, 10) || 0,
      roomsTotal: Number.parseInt(form.roomsTotal, 10) || 0,
    });
    setHotelId(null);
  }

  function shareHotelLink(hotel: (typeof data.hotels)[number]) {
    void Share.share({
      message: `Hotel block for ${data.profile.coupleName}\n${hotel.name}\n${hotel.address}\nRate: ${formatCurrency(hotel.rate)}\nDeadline: ${formatShortDate(hotel.deadline)}\nContact: ${hotel.contact}`,
      title: `${hotel.name} hotel block`,
    });
  }

  return (
    <Screen>
      <SectionHeader subtitle="Room blocks, deadlines, booking links, contacts, and shuttle notes." title="Hotels" />

      <View style={styles.metricRow}>
        <MetricCard icon="bed-king-outline" label="Rooms Booked" value={`${booked}/${total}`} />
        <MetricCard icon="bus-clock" label="Shuttles" value={data.hotels.filter((hotel) => hotel.shuttle).length.toString()} />
      </View>

      {data.hotels.map((hotel) => {
        const progress = hotel.roomsTotal ? (hotel.roomsBooked / hotel.roomsTotal) * 100 : 0;
        return (
          <Card key={hotel.id} style={styles.hotelCard}>
            <View style={styles.header}>
              <View style={styles.copy}>
                <Text style={[styles.name, { color: colors.text }]}>{hotel.name}</Text>
                <Text style={[styles.address, { color: colors.muted }]}>{hotel.address}</Text>
              </View>
              <Text style={[styles.rate, { color: colors.primary }]}>{formatCurrency(hotel.rate)}</Text>
            </View>
            <ProgressBar value={progress} />
            <View style={styles.metaRow}>
              <Text style={[styles.meta, { color: colors.muted }]}>{hotel.roomsBooked} of {hotel.roomsTotal} rooms booked</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>Deadline {formatShortDate(hotel.deadline)}</Text>
            </View>
            <View style={styles.contactRow}>
              <Ionicons color={colors.accent} name={hotel.shuttle ? 'bus-outline' : 'car-outline'} size={18} />
              <Text style={[styles.contact, { color: colors.text }]}>{hotel.shuttle ? 'Shuttle arranged' : 'No shuttle yet'} - {hotel.contact}</Text>
            </View>
            <View style={styles.actions}>
              <PrimaryButton icon="share-outline" label="Share Guest Link" onPress={() => shareHotelLink(hotel)} variant="ghost" />
              <PrimaryButton icon="create-outline" label="Edit Block" onPress={() => openHotel(hotel)} variant="ghost" />
            </View>
          </Card>
        );
      })}

      <FormSheet
        onClose={() => setHotelId(null)}
        subtitle={activeHotel ? `Update room pickup for ${activeHotel.name}.` : undefined}
        title="Edit Hotel Block"
        visible={Boolean(hotelId)}
      >
        <FormField keyboardType="number-pad" label="Rooms booked" onChangeText={(value) => setForm((current) => ({ ...current, roomsBooked: value }))} value={form.roomsBooked} />
        <FormField keyboardType="number-pad" label="Rooms total" onChangeText={(value) => setForm((current) => ({ ...current, roomsTotal: value }))} value={form.roomsTotal} />
        <PrimaryButton icon="checkmark-outline" label="Save Hotel Block" onPress={saveHotel} />
      </FormSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  hotelCard: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.headingSemi,
    fontSize: 25,
  },
  address: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  rate: {
    fontFamily: fonts.headingSemi,
    fontSize: 23,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  meta: {
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  contactRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  contact: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
