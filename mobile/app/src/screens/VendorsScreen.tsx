import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AccordionCard } from '../components/AccordionCard';
import { Card } from '../components/Card';
import { FilterPill } from '../components/FilterPill';
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
import { VendorStatus } from '../types';
import { formatCurrency, formatShortDate, isDateInputValid } from '../utils/format';

const vendorStatuses: VendorStatus[] = ['Pending', 'Signed', 'Ongoing', 'Completed'];

export function VendorsScreen() {
  const { colors } = useAppTheme();
  const { addDocument, addVendor, data, loading, recordVendorPayment, refresh, scheduleVendorPayment, updateVendor } = usePlanningData();
  const [addOpen, setAddOpen] = useState(false);
  const [scheduleVendorId, setScheduleVendorId] = useState<string | null>(null);
  const [paymentVendorId, setPaymentVendorId] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [vendorError, setVendorError] = useState('');
  const [vendorPaymentError, setVendorPaymentError] = useState('');
  const [vendorPaymentForm, setVendorPaymentForm] = useState({ amount: '', date: '', note: '' });
  const [vendorForm, setVendorForm] = useState({
    category: '',
    committed: '',
    name: '',
    nextPaymentDate: '',
    paid: '',
  });
  const contractsSigned = data.vendors.filter((vendor) => vendor.status === 'Signed' || vendor.status === 'Completed').length;
  const totalPaid = data.vendors.reduce((sum, vendor) => sum + vendor.paid, 0);
  const committed = data.vendors.reduce((sum, vendor) => sum + vendor.committed, 0);
  const scheduleVendor = useMemo(() => data.vendors.find((vendor) => vendor.id === scheduleVendorId), [data.vendors, scheduleVendorId]);
  const paymentVendor = useMemo(() => data.vendors.find((vendor) => vendor.id === paymentVendorId), [data.vendors, paymentVendorId]);

  function setVendorField(key: keyof typeof vendorForm, value: string) {
    setVendorForm((current) => ({ ...current, [key]: value }));
  }

  function saveVendor() {
    const committedAmount = Number.parseFloat(vendorForm.committed) || 0;
    const paidAmount = Number.parseFloat(vendorForm.paid) || 0;

    if (!vendorForm.name.trim() || !vendorForm.category.trim() || committedAmount <= 0) {
      setVendorError('Add a vendor name, category, and valid committed total.');
      return;
    }

    if (vendorForm.nextPaymentDate.trim() && !isDateInputValid(vendorForm.nextPaymentDate)) {
      setVendorError('Use a valid next payment date in YYYY-MM-DD format.');
      return;
    }

    addVendor({
      category: vendorForm.category.trim(),
      committed: committedAmount,
      name: vendorForm.name.trim(),
      nextPaymentDate: vendorForm.nextPaymentDate.trim() || undefined,
      paid: paidAmount,
      status: paidAmount >= committedAmount ? 'Completed' : 'Pending',
    });
    setVendorForm({ category: '', committed: '', name: '', nextPaymentDate: '', paid: '' });
    setVendorError('');
    setAddOpen(false);
  }

  function openVendorPayment(vendorId: string, payBalance = false) {
    const vendor = data.vendors.find((item) => item.id === vendorId);
    if (!vendor) {
      return;
    }

    setVendorPaymentForm({
      amount: payBalance ? String(vendor.remaining) : '',
      date: new Date().toISOString().split('T')[0],
      note: payBalance ? 'Balance marked paid in mobile app' : '',
    });
    setVendorPaymentError('');
    setPaymentVendorId(vendorId);
  }

  function saveVendorPayment() {
    const amount = Number.parseFloat(vendorPaymentForm.amount) || 0;
    if (!paymentVendorId || amount <= 0) {
      setVendorPaymentError('Enter a valid payment amount.');
      return;
    }

    if (!isDateInputValid(vendorPaymentForm.date)) {
      setVendorPaymentError('Add a valid payment date in YYYY-MM-DD format.');
      return;
    }

    recordVendorPayment(
      paymentVendorId,
      amount,
      vendorPaymentForm.note.trim() || 'Payment recorded in mobile app',
      vendorPaymentForm.date.trim(),
    );
    setVendorPaymentForm({ amount: '', date: '', note: '' });
    setVendorPaymentError('');
    setPaymentVendorId(null);
  }

  function createReceipt(vendorId: string) {
    const vendor = data.vendors.find((item) => item.id === vendorId);
    if (!vendor) {
      return;
    }

    addDocument({
      linkedTo: vendor.name,
      status: 'Approved',
      summary: `${vendor.name} receipt created from mobile vendor workflow for ${formatCurrency(vendor.paid)} paid.`,
      title: `${vendor.name} Receipt`,
      type: 'Receipt',
    });
  }

  function saveScheduleDate() {
    if (!scheduleVendorId) {
      return;
    }

    if (!isDateInputValid(paymentDate)) {
      setScheduleError('Add a valid date in YYYY-MM-DD format.');
      return;
    }

    scheduleVendorPayment(scheduleVendorId, paymentDate.trim());
    setPaymentDate('');
    setScheduleError('');
    setScheduleVendorId(null);
  }

  return (
    <Screen onRefresh={refresh} refreshing={loading}>
      <SectionHeader centered subtitle="Track contracts, deposits, balances, and next payments." title="Vendors" />

      <Card style={styles.quickAddCard}>
        <View style={styles.quickAddCopy}>
          <Text style={[styles.quickAddTitle, { color: colors.text }]}>Vendor Workspace</Text>
          <Text style={[styles.quickAddMeta, { color: colors.muted }]}>Add vendors, track payments, and create receipts without leaving the app.</Text>
        </View>
        <PrimaryButton
          icon="add"
          label="Add Vendor"
          onPress={() => {
            setVendorError('');
            setAddOpen(true);
          }}
        />
      </Card>

      <View style={styles.metricRow}>
        <MetricCard icon="clipboard-check-outline" label="Contracts Signed" value={`${contractsSigned} / ${data.vendors.length}`} />
        <MetricCard icon="cash-check" label="Total Paid" value={formatCurrency(totalPaid)} />
      </View>

      <Card style={styles.summary}>
        <View style={styles.summaryHeader}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>Total Committed</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>{formatCurrency(committed)}</Text>
        </View>
        <ProgressBar value={(totalPaid / committed) * 100} />
        <Text style={[styles.summaryMeta, { color: colors.muted }]}>{formatCurrency(committed - totalPaid)} remaining across vendors</Text>
      </Card>

      {data.vendors.map((vendor) => (
        <AccordionCard
          key={vendor.id}
          headerRight={<StatusPill status={vendor.status} />}
          subtitle={`${vendor.category} - next payment ${formatShortDate(vendor.nextPaymentDate)}`}
          title={vendor.name}
        >
          <View style={styles.paymentGrid}>
            <View>
              <Text style={[styles.label, { color: colors.muted }]}>Committed</Text>
              <Text style={[styles.value, { color: colors.text }]}>{formatCurrency(vendor.committed)}</Text>
            </View>
            <View>
              <Text style={[styles.label, { color: colors.muted }]}>Paid</Text>
              <Text style={[styles.value, { color: colors.primary }]}>{formatCurrency(vendor.paid)}</Text>
            </View>
            <View>
              <Text style={[styles.label, { color: colors.muted }]}>Remaining</Text>
              <Text style={[styles.value, { color: colors.text }]}>{formatCurrency(vendor.remaining)}</Text>
            </View>
          </View>
          <ProgressBar value={vendor.committed ? (vendor.paid / vendor.committed) * 100 : 0} />

          <Text style={[styles.subheading, { color: colors.text }]}>Vendor Status</Text>
          <View style={styles.statusActions}>
            {vendorStatuses.map((status) => (
              <FilterPill active={vendor.status === status} key={status} label={status === 'Signed' ? 'Contract Signed' : status} onPress={() => updateVendor(vendor.id, { status })} />
            ))}
          </View>

          <Text style={[styles.subheading, { color: colors.text }]}>Payment History</Text>
          {vendor.payments.length ? (
            vendor.payments.map((payment) => (
              <View key={payment.id} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
                <MaterialCommunityIcons color={colors.accent} name="receipt-text-outline" size={18} />
                <View style={styles.historyCopy}>
                  <Text style={[styles.historyNote, { color: colors.text }]}>{payment.note}</Text>
                  <Text style={[styles.historyDate, { color: colors.muted }]}>{formatShortDate(payment.date)}</Text>
                </View>
                <Text style={[styles.historyAmount, { color: colors.primary }]}>{formatCurrency(payment.amount)}</Text>
              </View>
            ))
          ) : (
            <Text style={[styles.empty, { color: colors.muted }]}>No payments recorded yet.</Text>
          )}

          <View style={styles.actions}>
            <PrimaryButton icon="card-outline" label="Add Payment" onPress={() => openVendorPayment(vendor.id)} />
            <PrimaryButton icon="checkmark-circle-outline" label="Mark Paid" onPress={() => openVendorPayment(vendor.id, true)} variant="gold" />
            <PrimaryButton
              icon="calendar-outline"
              label="Schedule"
              onPress={() => {
                setPaymentDate(vendor.nextPaymentDate ?? '');
                setScheduleError('');
                setScheduleVendorId(vendor.id);
              }}
              variant="ghost"
            />
            <PrimaryButton icon="document-text-outline" label="Receipt" onPress={() => createReceipt(vendor.id)} variant="gold" />
          </View>
        </AccordionCard>
      ))}

      <FormSheet onClose={() => setAddOpen(false)} subtitle="Create a vendor record with contract value, deposit, and next payment date." title="Add Vendor" visible={addOpen}>
        <FormField label="Vendor name" onChangeText={(value) => setVendorField('name', value)} placeholder="Park Florals" value={vendorForm.name} />
        <FormField label="Category" onChangeText={(value) => setVendorField('category', value)} placeholder="Florist" value={vendorForm.category} />
        <FormField
          keyboardType="numeric"
          label="Committed total"
          onChangeText={(value) => setVendorField('committed', value)}
          placeholder="2500"
          value={vendorForm.committed}
        />
        <FormField keyboardType="numeric" label="Already paid" onChangeText={(value) => setVendorField('paid', value)} placeholder="700" value={vendorForm.paid} />
        <FormField
          label="Next payment date"
          onChangeText={(value) => setVendorField('nextPaymentDate', value)}
          placeholder="YYYY-MM-DD"
          value={vendorForm.nextPaymentDate}
        />
        {vendorError ? <Text style={[styles.errorText, { color: colors.danger }]}>{vendorError}</Text> : null}
        <PrimaryButton icon="checkmark-outline" label="Save Vendor" onPress={saveVendor} />
      </FormSheet>

      <FormSheet
        onClose={() => setPaymentVendorId(null)}
        subtitle={paymentVendor ? `Record a payment for ${paymentVendor.name}. A payment date is required.` : undefined}
        title="Record Vendor Payment"
        visible={Boolean(paymentVendorId)}
      >
        <FormField keyboardType="numeric" label="Payment amount" onChangeText={(value) => setVendorPaymentForm((current) => ({ ...current, amount: value }))} placeholder="500" value={vendorPaymentForm.amount} />
        <FormField label="Payment date" onChangeText={(value) => setVendorPaymentForm((current) => ({ ...current, date: value }))} placeholder="YYYY-MM-DD" value={vendorPaymentForm.date} />
        <FormField label="Note" onChangeText={(value) => setVendorPaymentForm((current) => ({ ...current, note: value }))} placeholder="Deposit, retainer, balance..." value={vendorPaymentForm.note} />
        {vendorPaymentError ? <Text style={[styles.errorText, { color: colors.danger }]}>{vendorPaymentError}</Text> : null}
        <PrimaryButton icon="checkmark-outline" label="Save Payment" onPress={saveVendorPayment} />
      </FormSheet>

      <FormSheet
        onClose={() => setScheduleVendorId(null)}
        subtitle={scheduleVendor ? `Set the next due date for ${scheduleVendor.name}.` : undefined}
        title="Schedule Payment"
        visible={Boolean(scheduleVendorId)}
      >
        <FormField label="Next payment date" onChangeText={setPaymentDate} placeholder="YYYY-MM-DD" value={paymentDate} />
        {scheduleError ? <Text style={[styles.errorText, { color: colors.danger }]}>{scheduleError}</Text> : null}
        <PrimaryButton icon="calendar-outline" label="Save Schedule" onPress={saveScheduleDate} />
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
  summary: {
    marginBottom: spacing.lg,
  },
  summaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 25,
  },
  summaryValue: {
    fontFamily: fonts.heading,
    fontSize: 28,
  },
  summaryMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  paymentGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  errorText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
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
  subheading: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    marginTop: spacing.lg,
  },
  statusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  historyRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  historyCopy: {
    flex: 1,
  },
  historyNote: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  historyDate: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
