import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { fonts, palette, radii, spacing, useAppTheme } from '../theme';

const swatches = [
  { label: 'Blush', value: palette.blush },
  { label: 'Rose', value: palette.rose },
  { label: 'Gold', value: palette.gold },
  { label: 'Cream', value: palette.cream },
  { label: 'Sage', value: palette.sage },
];

const inspiration = [
  { icon: 'flower-tulip-outline', title: 'Florals', detail: 'Garden roses, ranunculus, soft greenery, champagne ribbon.' },
  { icon: 'silverware-fork-knife', title: 'Tablescape', detail: 'Ivory linens, gold flatware, blush menu cards, candle clusters.' },
  { icon: 'camera-outline', title: 'Photo Style', detail: 'Bright editorial portraits with warm sunset couple photos.' },
];

export function MoodBoardScreen() {
  const { colors } = useAppTheme();

  return (
    <Screen>
      <SectionHeader subtitle="Keep the visual direction clear for vendors and design decisions." title="Mood Board" />

      <Card style={styles.paletteCard}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Wedding Palette</Text>
        <View style={styles.swatches}>
          {swatches.map((swatch) => (
            <View key={swatch.label} style={styles.swatchItem}>
              <View style={[styles.swatch, { backgroundColor: swatch.value, borderColor: colors.border }]} />
              <Text style={[styles.swatchLabel, { color: colors.muted }]}>{swatch.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      {inspiration.map((item) => (
        <Card key={item.title} style={styles.inspirationCard}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
            <MaterialCommunityIcons color={colors.primary} name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={28} />
          </View>
          <View style={styles.inspirationCopy}>
            <Text style={[styles.inspirationTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.inspirationDetail, { color: colors.muted }]}>{item.detail}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  paletteCard: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 25,
    marginBottom: spacing.md,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  swatchItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  swatch: {
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    width: 48,
  },
  swatchLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  inspirationCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: radii.lg,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  inspirationCopy: {
    flex: 1,
  },
  inspirationTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 23,
  },
  inspirationDetail: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 2,
  },
});
