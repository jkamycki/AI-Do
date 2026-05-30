import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
import { DocumentItem } from '../types';
import { formatShortDate } from '../utils/format';

export function FilesScreen() {
  const { colors } = useAppTheme();
  const { addDocument, data, updateDocumentStatus } = usePlanningData();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({
    linkedTo: '',
    status: 'Needs Review' as DocumentItem['status'],
    summary: '',
    title: '',
    type: 'Contract' as DocumentItem['type'],
  });

  function saveDocument() {
    if (!form.title.trim()) {
      return;
    }

    addDocument({
      linkedTo: form.linkedTo.trim() || 'General',
      status: form.status,
      summary: form.summary.trim() || 'Added from the mobile document workspace.',
      title: form.title.trim(),
      type: form.type,
    });
    setForm({ linkedTo: '', status: 'Needs Review', summary: '', title: '', type: 'Contract' });
    setSheetOpen(false);
  }

  return (
    <Screen>
      <SectionHeader subtitle="Contracts, receipts, inspiration boards, planning exports, AI summaries, and linked vendor documents." title="Documents" />

      <Card style={styles.uploadCard}>
        <View style={[styles.uploadIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name="cloud-upload-outline" size={30} />
        </View>
        <View style={styles.uploadCopy}>
          <Text style={[styles.uploadTitle, { color: colors.text }]}>Add a contract or receipt</Text>
          <Text style={[styles.uploadMeta, { color: colors.muted }]}>Store vendor documents in the same place as payments and tasks.</Text>
        </View>
        <PrimaryButton icon="add" label="Add" onPress={() => setSheetOpen(true)} />
      </Card>

      {data.documents.map((file) => (
        <Card key={file.id} style={styles.fileCard}>
          <View style={[styles.fileIcon, { backgroundColor: colors.primarySoft }]}>
            <MaterialCommunityIcons color={colors.primary} name={iconForType(file.type)} size={25} />
          </View>
          <View style={styles.fileCopy}>
            <Text style={[styles.fileName, { color: colors.text }]}>{file.title}</Text>
            <Text style={[styles.fileMeta, { color: colors.muted }]}>{file.linkedTo} - updated {formatShortDate(file.updatedAt)}</Text>
            <Text style={[styles.fileSummary, { color: colors.muted }]}>{file.summary}</Text>
          </View>
          <View style={styles.fileActions}>
            <Text style={[styles.fileStatus, { backgroundColor: colors.accentSoft, color: colors.text }]}>{file.status}</Text>
            <PrimaryButton icon="checkmark-outline" label="Approve" onPress={() => updateDocumentStatus(file.id, 'Approved')} variant="ghost" />
          </View>
        </Card>
      ))}

      <FormSheet onClose={() => setSheetOpen(false)} subtitle="Add contracts, receipts, timelines, mood boards, and planning exports." title="Add Document" visible={sheetOpen}>
        <FormField label="Title" onChangeText={(value) => setForm((current) => ({ ...current, title: value }))} placeholder="Florals Receipt" value={form.title} />
        <FormField label="Linked to" onChangeText={(value) => setForm((current) => ({ ...current, linkedTo: value }))} placeholder="Park Florals" value={form.linkedTo} />
        <FormField multiline label="Summary" onChangeText={(value) => setForm((current) => ({ ...current, summary: value }))} placeholder="Short note about this document" value={form.summary} />
        <View style={styles.choiceRow}>
          {(['Contract', 'Receipt', 'Timeline', 'Mood Board', 'Other'] as DocumentItem['type'][]).map((type) => (
            <FilterPill active={form.type === type} key={type} label={type} onPress={() => setForm((current) => ({ ...current, type }))} />
          ))}
        </View>
        <PrimaryButton icon="checkmark-outline" label="Save Document" onPress={saveDocument} />
      </FormSheet>
    </Screen>
  );
}

function iconForType(type: string): keyof typeof MaterialCommunityIcons.glyphMap {
  if (type === 'Receipt') return 'receipt-text-outline';
  if (type === 'Timeline') return 'calendar-clock';
  if (type === 'Mood Board') return 'image-multiple-outline';
  if (type === 'Contract') return 'file-sign';
  return 'file-document-outline';
}

const styles = StyleSheet.create({
  uploadCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  uploadIcon: {
    alignItems: 'center',
    borderRadius: radii.lg,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  uploadCopy: {
    flex: 1,
  },
  uploadTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 22,
  },
  uploadMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  fileCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  fileIcon: {
    alignItems: 'center',
    borderRadius: radii.md,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  fileCopy: {
    flex: 1,
  },
  fileName: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  fileMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  fileSummary: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  fileStatus: {
    borderRadius: radii.xl,
    fontFamily: fonts.semibold,
    fontSize: 12,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  fileActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
