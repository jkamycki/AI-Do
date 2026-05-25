import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { AccordionCard } from '../components/AccordionCard';
import { MetricCard } from '../components/MetricCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, spacing, useAppTheme } from '../theme';
import { formatCurrency } from '../utils/format';

export function ContractsScreen() {
  const { colors } = useAppTheme();
  const { data, respondAsAria, updateContractStatus } = usePlanningData();
  const signed = data.contracts.filter((contract) => contract.status === 'Signed').length;
  const needsReview = data.contracts.filter((contract) => contract.status !== 'Signed').length;

  return (
    <Screen>
      <SectionHeader subtitle="AI-assisted contract review, risks, clauses, negotiation notes, and linked vendors." title="Contracts" />

      <View style={styles.metricRow}>
        <MetricCard icon="file-sign" label="Signed" value={`${signed}/${data.contracts.length}`} />
        <MetricCard icon="alert-circle-outline" label="Review" value={needsReview.toString()} />
      </View>

      {data.contracts.map((contract) => (
        <AccordionCard
          key={contract.id}
          headerRight={<Text style={[styles.status, { color: colors.primary }]}>{contract.status}</Text>}
          subtitle={`${contract.vendorName} - ${formatCurrency(contract.value)}`}
          title={contract.title}
        >
          <View style={styles.riskRow}>
            <Ionicons color={colors.accent} name="shield-checkmark-outline" size={22} />
            <Text style={[styles.riskText, { color: colors.text }]}>{contract.riskLevel} risk - {contract.nextAction}</Text>
          </View>
          <Text style={[styles.subheading, { color: colors.text }]}>Clauses to Watch</Text>
          {contract.clauses.map((clause) => (
            <View key={clause} style={styles.clauseRow}>
              <Ionicons color={colors.primary} name="checkmark-circle-outline" size={17} />
              <Text style={[styles.clause, { color: colors.muted }]}>{clause}</Text>
            </View>
          ))}
          <View style={styles.actions}>
            <PrimaryButton icon="checkmark-circle-outline" label="Mark Signed" onPress={() => updateContractStatus(contract.id, 'Signed')} />
            <PrimaryButton
              icon="sparkles-outline"
              label="Ask Aria"
              onPress={() => respondAsAria(`Review ${contract.title} for ${contract.vendorName}`)}
              variant="gold"
            />
            <PrimaryButton icon="create-outline" label="Negotiate" onPress={() => updateContractStatus(contract.id, 'Negotiating')} variant="ghost" />
          </View>
        </AccordionCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  status: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  riskRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  riskText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  subheading: {
    fontFamily: fonts.headingSemi,
    fontSize: 20,
    marginBottom: spacing.sm,
  },
  clauseRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  clause: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
