import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { FilterPill } from '../components/FilterPill';
import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';
import { VenueStatus } from '../types';

const bookedVendorOptions = [
  'Photographer',
  'Videographer',
  'Caterer',
  'DJ or Band',
  'Florist',
  'Officiant',
  'Cake',
  'Hair Stylist',
  'Makeup Artist',
  'Rentals',
  'Planner',
  'Transportation',
];

const stepCount = 5;

export function OnboardingScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { data, updateProfile, addTask, respondAsAria } = usePlanningData();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    partnerOne: data.profile.partnerOne,
    partnerTwo: data.profile.partnerTwo,
    weddingDate: data.profile.weddingDate.split('T')[0],
    totalBudget: String(data.profile.totalBudget),
    guestTarget: String(data.profile.guestTarget),
    venueStatus: data.profile.venueStatus,
    venue: data.profile.venue,
    location: data.profile.location,
    ariaQuestion: '',
  });
  const [bookedVendors, setBookedVendors] = useState<string[]>([]);
  const coupleName = useMemo(
    () => [form.partnerOne.trim(), form.partnerTwo.trim()].filter(Boolean).join(' & ') || data.profile.coupleName,
    [data.profile.coupleName, form.partnerOne, form.partnerTwo],
  );

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function persistCurrentStep() {
    if (step === 0 && form.partnerOne.trim() && form.partnerTwo.trim()) {
      updateProfile({
        coupleName,
        partnerOne: form.partnerOne.trim(),
        partnerTwo: form.partnerTwo.trim(),
        photoInitials: `${form.partnerOne.trim()[0] ?? 'A'}&${form.partnerTwo.trim()[0] ?? 'I'}`.toUpperCase(),
      });
    }

    if (step === 1) {
      const guestTarget = Number.parseInt(form.guestTarget, 10);
      const totalBudget = Number.parseFloat(form.totalBudget);
      updateProfile({
        guestTarget: Number.isFinite(guestTarget) && guestTarget > 0 ? guestTarget : data.profile.guestTarget,
        totalBudget: Number.isFinite(totalBudget) && totalBudget > 0 ? totalBudget : data.profile.totalBudget,
        weddingDate: form.weddingDate ? `${form.weddingDate}T17:00:00.000Z` : data.profile.weddingDate,
      });
    }

    if (step === 2) {
      updateProfile({
        location: form.location.trim() || data.profile.location,
        venue: form.venueStatus === 'Booked' ? form.venue.trim() || data.profile.venue : 'Venue to discover',
        venueStatus: form.venueStatus,
      });
    }

    if (step === 3 && bookedVendors.length) {
      bookedVendors.forEach((category) => {
        addTask({
          category: 'Vendors',
          detail: `Add contract, payment, and contact details for your ${category.toLowerCase()}.`,
          dueDate: new Date().toISOString().split('T')[0],
          title: `Finish ${category} vendor record`,
        });
      });
    }

    if (step === 4) {
      respondAsAria(
        form.ariaQuestion.trim() ||
          `Use my setup details for ${coupleName}: ${form.guestTarget} guests, ${form.totalBudget} budget, venue status ${form.venueStatus}. What should I do first?`,
      );
    }
  }

  function next() {
    persistCurrentStep();
    if (step >= stepCount - 1) {
      navigation.navigate('MainTabs');
      return;
    }
    setStep((current) => current + 1);
  }

  function skip() {
    if (step >= stepCount - 1) {
      navigation.navigate('MainTabs');
      return;
    }
    setStep((current) => current + 1);
  }

  function back() {
    if (step === 0) {
      navigation.goBack();
      return;
    }
    setStep((current) => current - 1);
  }

  function toggleVendor(vendor: string) {
    setBookedVendors((current) => (current.includes(vendor) ? current.filter((item) => item !== vendor) : [...current, vendor]));
  }

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.progressRow}>
        {Array.from({ length: stepCount }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressSegment,
              { backgroundColor: index <= step ? colors.primary : colors.border },
            ]}
          />
        ))}
      </View>

      {step === 0 ? (
        <SetupStep
          icon="heart"
          subtitle="First names are enough. The app uses them across dashboards, invitations, and Aria prompts."
          title="Let's personalize your planning space."
        >
          <FormField label="Your name" onChangeText={(value) => setField('partnerOne', value)} placeholder="First name" value={form.partnerOne} />
          <FormField label="Partner's name" onChangeText={(value) => setField('partnerTwo', value)} placeholder="First name" value={form.partnerTwo} />
        </SetupStep>
      ) : null}

      {step === 1 ? (
        <SetupStep
          icon="calendar-heart"
          subtitle="These estimates drive the budget, guest list, timeline, and checklist. You can change them later."
          title={`Build the plan around ${form.partnerOne || 'your'} date.`}
        >
          <FormField label="Wedding date" onChangeText={(value) => setField('weddingDate', value)} placeholder="YYYY-MM-DD" value={form.weddingDate} />
          <FormField keyboardType="numeric" label="Total budget" onChangeText={(value) => setField('totalBudget', value)} placeholder="30000" value={form.totalBudget} />
          <FormField keyboardType="numeric" label="Estimated guest count" onChangeText={(value) => setField('guestTarget', value)} placeholder="120" value={form.guestTarget} />
        </SetupStep>
      ) : null}

      {step === 2 ? (
        <SetupStep
          icon="map-marker-outline"
          subtitle="If you do not have a venue yet, A.I DO keeps discovery notes ready for Aria and your vendor shortlist."
          title="Where is the celebration headed?"
        >
          <View style={styles.choiceRow}>
            {(['Booked', 'Looking', 'Non-traditional'] as VenueStatus[]).map((status) => (
              <FilterPill active={form.venueStatus === status} key={status} label={status} onPress={() => setField('venueStatus', status)} />
            ))}
          </View>
          {form.venueStatus === 'Booked' ? (
            <FormField label="Venue name" onChangeText={(value) => setField('venue', value)} placeholder="Your venue name" value={form.venue} />
          ) : null}
          <FormField label="Planning location" onChangeText={(value) => setField('location', value)} placeholder="Austin, TX" value={form.location} />
        </SetupStep>
      ) : null}

      {step === 3 ? (
        <SetupStep
          icon="storefront-outline"
          subtitle="Tap anything already booked so the app can create follow-up tasks instead of nagging you to research it again."
          title="What vendors are already in motion?"
        >
          <View style={styles.vendorGrid}>
            {bookedVendorOptions.map((vendor) => {
              const active = bookedVendors.includes(vendor);
              return (
                <Pressable
                  key={vendor}
                  onPress={() => toggleVendor(vendor)}
                  style={({ pressed }) => [
                    styles.vendorChoice,
                    {
                      backgroundColor: active ? colors.primarySoft : colors.cardStrong,
                      borderColor: active ? colors.primary : colors.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Ionicons color={active ? colors.primary : colors.accent} name={active ? 'checkbox' : 'square-outline'} size={22} />
                  <Text style={[styles.vendorChoiceText, { color: colors.text }]}>{vendor}</Text>
                </Pressable>
              );
            })}
          </View>
        </SetupStep>
      ) : null}

      {step === 4 ? (
        <SetupStep
          icon="star-four-points-outline"
          subtitle="Aria can turn your setup into a practical first-week action plan."
          title="One calm handoff before the dashboard."
        >
          <Card style={styles.ariaCard}>
            <Text style={[styles.ariaText, { color: colors.text }]}>
              Hi {coupleName}. I can see the date, budget, guest count, venue direction, and vendor status you add here. Ask me anything, or head straight to your dashboard.
            </Text>
          </Card>
          <FormField multiline label="Ask Aria" onChangeText={(value) => setField('ariaQuestion', value)} placeholder="What should we do first?" value={form.ariaQuestion} />
        </SetupStep>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton label="Back" onPress={back} variant="ghost" />
        <PrimaryButton icon={step === stepCount - 1 ? 'home-outline' : 'arrow-forward'} label={step === stepCount - 1 ? 'Go to Dashboard' : 'Continue'} onPress={next} />
      </View>
      <Pressable onPress={skip} style={({ pressed }) => [styles.skip, { opacity: pressed ? 0.7 : 1 }]}>
        <Text style={[styles.skipText, { color: colors.muted }]}>Set up later</Text>
      </Pressable>
    </Screen>
  );
}

function SetupStep({
  children,
  icon,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  subtitle: string;
  title: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.step}>
      <View style={[styles.stepIcon, { backgroundColor: colors.primarySoft }]}>
        <MaterialCommunityIcons color={colors.primary} name={icon} size={28} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>
      <View style={styles.stepBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  ariaCard: {
    marginBottom: spacing.sm,
  },
  ariaText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  content: {
    paddingBottom: 120,
  },
  progressRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xxl,
  },
  progressSegment: {
    borderRadius: 999,
    flex: 1,
    height: 5,
  },
  skip: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  skipText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  step: {
    alignItems: 'flex-start',
  },
  stepBody: {
    gap: spacing.md,
    marginTop: spacing.lg,
    width: '100%',
  },
  stepIcon: {
    alignItems: 'center',
    borderRadius: radii.lg,
    height: 58,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    width: 58,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.sm,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 38,
    lineHeight: 44,
  },
  vendorChoice: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    width: '48%',
  },
  vendorChoiceText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  vendorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
