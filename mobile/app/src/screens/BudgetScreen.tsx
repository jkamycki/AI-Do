import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AccordionCard } from '../components/AccordionCard';
import { Card } from '../components/Card';
import { FormField } from '../components/FormField';
import { FormSheet } from '../components/FormSheet';
import { MetricCard } from '../components/MetricCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { StatusPill } from '../components/StatusPill';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, spacing, useAppTheme } from '../theme';
import { formatCurrency, formatShortDate, isDateInputValid } from '../utils/format';

export function BudgetScreen() {
  const { colors } = useAppTheme();
  const { addBudgetExpense, data, loading, recordBudgetPayment, refresh, updateBudgetExpense } = usePlanningData();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [paymentExpenseId, setPaymentExpenseId] = useState<string | null>(null);
  const [dueExpenseId, setDueExpenseId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({ amount: '', category: '', dueAmount: '', dueDate: '', title: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: '', note: '' });
  const [dueForm, setDueForm] = useState({ amount: '', date: '' });
  const [expenseError, setExpenseError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [dueError, setDueError] = useState('');
  const total = data.budget.reduce((sum, item) => sum + item.total, 0);
  const paid = data.budget.reduce((sum, item) => sum + item.paid, 0);
  const remaining = total - paid;
  const progress = total ? Math.round((paid / total) * 100) : 0;
  const paymentExpense = useMemo(() => data.budget.find((expense) => expense.id === paymentExpenseId), [data.budget, paymentExpenseId]);
  const dueExpense = useMemo(() => data.budget.find((expense) => expense.id === dueExpenseId), [data.budget, dueExpenseId]);

  function setExpenseField(key: keyof typeof expenseForm, value: string) {
    setExpenseForm((current) => ({ ...current, [key]: value }));
  }

  function saveExpense() {
    const totalAmount = Number.parseFloat(expenseForm.amount) || 0;
    const dueAmount = Number.parseFloat(expenseForm.dueAmount) || 0;

    if (!expenseForm.title.trim() || !expenseForm.category.trim() || totalAmount <= 0) {
      setExpenseError('Add a title, category, and valid total amount.');
      return;
    }

    if (dueAmount > 0 && !expenseForm.dueDate.trim()) {
      setExpenseError('Add a due date when you enter a next payment amount.');
      return;
    }

    if (dueAmount > 0 && !isDateInputValid(expenseForm.dueDate)) {
      setExpenseError('Use a valid due date in YYYY-MM-DD format.');
      return;
    }

    addBudgetExpense({
      category: expenseForm.category.trim(),
      nextPayment: expenseForm.dueDate.trim() && dueAmount > 0 ? { amount: dueAmount, date: expenseForm.dueDate.trim() } : undefined,
      title: expenseForm.title.trim(),
      total: totalAmount,
    });
    setExpenseForm({ amount: '', category: '', dueAmount: '', dueDate: '', title: '' });
    setExpenseError('');
    setExpenseOpen(false);
  }

  function savePayment() {
    const amount = Number.parseFloat(paymentForm.amount) || 0;
    if (!paymentExpenseId || amount <= 0) {
      setPaymentError('Enter a valid payment amount.');
      return;
    }

    if (!isDateInputValid(paymentForm.date)) {
      setPaymentError('Add a valid payment date in YYYY-MM-DD format.');
      return;
    }

    recordBudgetPayment(paymentExpenseId, amount, paymentForm.note.trim() || 'Payment recorded in mobile app', paymentForm.date.trim());
    setPaymentForm({ amount: '', date: '', note: '' });
    setPaymentError('');
    setPaymentExpenseId(null);
  }

  function saveNextDue() {
    const amount = Number.parseFloat(dueForm.amount) || 0;
    if (!dueExpenseId || amount <= 0) {
      setDueError('Enter a valid amount due.');
      return;
    }

    if (!isDateInputValid(dueForm.date)) {
      setDueError('Add a valid due date in YYYY-MM-DD format.');
      return;
    }

    updateBudgetExpense(dueExpenseId, { nextPayment: { amount, date: dueForm.date.trim() } });
    setDueForm({ amount: '', date: '' });
    setDueError('');
    setDueExpenseId(null);
  }

  return (
    <Screen onRefresh={refresh} refreshing={loading}>
      <SectionHeader centered subtitle="Know what is paid, what is due, and what needs attention." title="Budget Summary" />

      <Card style={styles.quickAddCard}>
        <View style={styles.quickAddCopy}>
          <Text style={[styles.quickAddTitle, { color: colors.text }]}>Budget Control</Text>
          <Text style={[styles.quickAddMeta, { color: colors.muted }]}>Add expenses, record payments, and keep the next due date visible.</Text>
        </View>
        <PrimaryButton icon="add" label="Add Expense" onPress={() => setExpenseOpen(true)} />
      </Card>

      <View style={styles.metricRow}>
        <MetricCard icon="wallet-outline" label="Total Budget" value={formatCurrency(total)} />
        <MetricCard icon="cash-check" label="Paid" value={formatCurrency(paid)} />
      </View>
      <MetricCard icon="calendar-alert" label="Remaining" value={formatCurrency(remaining)} />

      <Card style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={[styles.progressTitle, { color: colors.text }]}>Spending Progress</Text>
            <Text style={[styles.progressMeta, { color: colors.muted }]}>{progress}% of budget paid</Text>
          </View>
          <StatusPill status={remaining >= 0 ? 'On Track' : 'Over Budget'} />
        </View>
        <ProgressBar value={progress} />
      </Card>

      {data.budget.map((expense) => {
        const expenseProgress = expense.total ? (expense.paid / expense.total) * 100 : 0;
        return (
          <AccordionCard
            key={expense.id}
            headerRight={<Text style={[styles.amount, { color: colors.primary }]}>{formatCurrency(expense.total)}</Text>}
            subtitle={`${expense.category} - ${formatCurrency(expense.total - expense.paid)} remaining`}
            title={expense.title}
          >
            <View style={styles.expenseHeader}>
              <View>
                <Text style={[styles.label, { color: colors.muted }]}>Paid</Text>
                <Text style={[styles.value, { color: colors.primary }]}>{formatCurrency(expense.paid)}</Text>
              </View>
              <View>
                <Text style={[styles.label, { color: colors.muted }]}>Next Payment</Text>
                <Text style={[styles.value, { color: colors.text }]}>
                  {expense.nextPayment ? formatCurrency(expense.nextPayment.amount) : 'None'}
                </Text>
              </View>
            </View>
            <ProgressBar value={expenseProgress} />
            <View style={styles.dueRow}>
              <Ionicons color={colors.accent} name="calendar-outline" size={18} />
              <Text style={[styles.dueText, { color: colors.muted }]}>
                {expense.nextPayment ? `Due ${formatShortDate(expense.nextPayment.date)}` : 'Paid in full'}
              </Text>
            </View>

            <Text style={[styles.subheading, { color: colors.text }]}>Payment Details</Text>
            {expense.payments.length ? (
              expense.payments.map((payment) => (
                <View key={payment.id} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.historyNote, { color: colors.text }]}>{payment.note}</Text>
                  <Text style={[styles.historyAmount, { color: colors.primary }]}>{formatCurrency(payment.amount)}</Text>
                </View>
              ))
            ) : (
              <Text style={[styles.empty, { color: colors.muted }]}>No payment history yet.</Text>
            )}

            <View style={styles.actions}>
              <PrimaryButton
                icon="card-outline"
                label="Add Payment"
                onPress={() => {
                  setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], note: '' });
                  setPaymentError('');
                  setPaymentExpenseId(expense.id);
                }}
              />
              <PrimaryButton
                icon="time-outline"
                label="Next Due"
                onPress={() => {
                  setDueForm({
                    amount: expense.nextPayment?.amount ? String(expense.nextPayment.amount) : '',
                    date: expense.nextPayment?.date ?? '',
                  });
                  setDueError('');
                  setDueExpenseId(expense.id);
                }}
                variant="ghost"
              />
            </View>
          </AccordionCard>
        );
      })}

      <FormSheet onClose={() => setExpenseOpen(false)} subtitle="Create a new line item and optional next payment." title="Add Expense" visible={expenseOpen}>
        <FormField label="Title" onChangeText={(value) => setExpenseField('title', value)} placeholder="Photographer" value={expenseForm.title} />
        <FormField label="Category" onChangeText={(value) => setExpenseField('category', value)} placeholder="Photo & Video" value={expenseForm.category} />
        <FormField keyboardType="numeric" label="Total amount" onChangeText={(value) => setExpenseField('amount', value)} placeholder="4200" value={expenseForm.amount} />
        <FormField keyboardType="numeric" label="Next due amount" onChangeText={(value) => setExpenseField('dueAmount', value)} placeholder="1000" value={expenseForm.dueAmount} />
        <FormField label="Next due date" onChangeText={(value) => setExpenseField('dueDate', value)} placeholder="YYYY-MM-DD" value={expenseForm.dueDate} />
        {expenseError ? <Text style={[styles.errorText, { color: colors.danger }]}>{expenseError}</Text> : null}
        <PrimaryButton icon="checkmark-outline" label="Save Expense" onPress={saveExpense} />
      </FormSheet>

      <FormSheet
        onClose={() => setPaymentExpenseId(null)}
        subtitle={paymentExpense ? `Record a payment toward ${paymentExpense.title}.` : undefined}
        title="Add Payment"
        visible={Boolean(paymentExpenseId)}
      >
        <FormField keyboardType="numeric" label="Payment amount" onChangeText={(value) => setPaymentForm((current) => ({ ...current, amount: value }))} placeholder="500" value={paymentForm.amount} />
        <FormField label="Payment date" onChangeText={(value) => setPaymentForm((current) => ({ ...current, date: value }))} placeholder="YYYY-MM-DD" value={paymentForm.date} />
        <FormField label="Note" onChangeText={(value) => setPaymentForm((current) => ({ ...current, note: value }))} placeholder="Deposit, retainer, balance..." value={paymentForm.note} />
        {paymentError ? <Text style={[styles.errorText, { color: colors.danger }]}>{paymentError}</Text> : null}
        <PrimaryButton icon="card-outline" label="Record Payment" onPress={savePayment} />
      </FormSheet>

      <FormSheet
        onClose={() => setDueExpenseId(null)}
        subtitle={dueExpense ? `Update the next payment for ${dueExpense.title}.` : undefined}
        title="Next Due"
        visible={Boolean(dueExpenseId)}
      >
        <FormField keyboardType="numeric" label="Amount due" onChangeText={(value) => setDueForm((current) => ({ ...current, amount: value }))} placeholder="1000" value={dueForm.amount} />
        <FormField label="Due date" onChangeText={(value) => setDueForm((current) => ({ ...current, date: value }))} placeholder="YYYY-MM-DD" value={dueForm.date} />
        {dueError ? <Text style={[styles.errorText, { color: colors.danger }]}>{dueError}</Text> : null}
        <PrimaryButton icon="time-outline" label="Save Due Date" onPress={saveNextDue} />
      </FormSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
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
  progressCard: {
    marginVertical: spacing.lg,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  progressTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 24,
  },
  progressMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  amount: {
    fontFamily: fonts.headingSemi,
    fontSize: 20,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: fonts.headingSemi,
    fontSize: 22,
    marginTop: 2,
  },
  dueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  dueText: {
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  subheading: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    marginTop: spacing.lg,
  },
  historyRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  historyNote: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  historyAmount: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  errorText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
