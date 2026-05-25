import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';

export function AriaScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const { data, respondAsAria } = usePlanningData();
  const [draft, setDraft] = useState('');

  function askAria() {
    respondAsAria(draft);
    setDraft('');
  }

  return (
    <Screen>
      <SectionHeader
        eyebrow="AI Wedding Planner"
        subtitle="Vendor follow-ups, budget checks, timeline gaps, RSVP reminders, contract questions, and day-of prep."
        title="Aria"
      />

      <Card style={styles.insightCard}>
        <View style={[styles.aiIcon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons color={colors.primary} name="star-four-points-outline" size={30} />
        </View>
        <View style={styles.insightCopy}>
          <Text style={[styles.insightTitle, { color: colors.text }]}>Today's Focus</Text>
          <Text style={[styles.insightText, { color: colors.muted }]}>
            Review {data.contracts.filter((contract) => contract.status !== 'Signed').length} contracts, follow up on{' '}
            {data.guests.filter((guest) => guest.rsvp === 'Pending').length} pending RSVPs, and publish travel details.
          </Text>
        </View>
      </Card>

      <Card style={styles.memoryCard}>
        <View style={[styles.memoryIcon, { backgroundColor: colors.accentSoft }]}>
          <Ionicons color={colors.primary} name="bookmark-outline" size={22} />
        </View>
        <View style={styles.memoryCopy}>
          <Text style={[styles.memoryTitle, { color: colors.text }]}>Aria Memory</Text>
          <Text numberOfLines={3} style={[styles.memoryText, { color: colors.muted }]}>{data.settings.ariaMemory}</Text>
        </View>
        <PrimaryButton icon="settings-outline" label="Edit" onPress={() => navigation.navigate('Settings')} variant="ghost" />
      </Card>

      <View style={styles.promptGrid}>
        {['Draft vendor email', 'Check budget risks', 'Summarize contracts', 'Plan day-of tasks'].map((prompt) => (
          <Pressable
            key={prompt}
            onPress={() => setDraft(prompt)}
            style={({ pressed }) => [
              styles.prompt,
              { backgroundColor: colors.cardStrong, borderColor: colors.border, opacity: pressed ? 0.76 : 1 },
            ]}
          >
            <Text style={[styles.promptText, { color: colors.text }]}>{prompt}</Text>
          </Pressable>
        ))}
      </View>

      {data.ariaMessages.map((message) => (
        <View key={message.id} style={[styles.messageRow, message.role === 'user' && styles.userMessageRow]}>
          <Card
            padding={spacing.md}
            style={[
              styles.message,
              message.role === 'user' && { backgroundColor: colors.primarySoft },
            ]}
          >
            <Text style={[styles.messageLabel, { color: message.role === 'user' ? colors.primary : colors.accent }]}>
              {message.role === 'user' ? 'You' : 'Aria'}
            </Text>
            <Text style={[styles.messageText, { color: colors.text }]}>{message.text}</Text>
          </Card>
        </View>
      ))}

      <Card style={styles.composer}>
        <TextInput
          multiline
          onChangeText={setDraft}
          placeholder="Ask Aria what to do next..."
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.text }]}
          value={draft}
        />
        <PrimaryButton icon="send-outline" label="Ask Aria" onPress={askAria} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  insightCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  aiIcon: {
    alignItems: 'center',
    borderRadius: radii.lg,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  insightCopy: {
    flex: 1,
  },
  insightTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
  },
  insightText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 3,
  },
  memoryCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  memoryCopy: {
    flex: 1,
  },
  memoryIcon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  memoryText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  memoryTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  promptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  prompt: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  promptText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  messageRow: {
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  userMessageRow: {
    alignItems: 'flex-end',
  },
  message: {
    maxWidth: '86%',
  },
  messageLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  messageText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },
  composer: {
    gap: spacing.md,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 15,
    minHeight: 78,
    textAlignVertical: 'top',
  },
});
