import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { FilterPill } from '../components/FilterPill';
import { FormField } from '../components/FormField';
import { FormSheet } from '../components/FormSheet';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { usePlanningData } from '../state/PlanningDataContext';
import { fonts, radii, spacing, useAppTheme } from '../theme';
import { TaskCategory } from '../types';
import { formatShortDate } from '../utils/format';

type PlanningTab = 'All' | TaskCategory;

const tabs: PlanningTab[] = ['All', 'Guests', 'Budget', 'Files', 'Vendors', 'Timeline', 'Website', 'Day Of'];

export function ChecklistScreen() {
  const { colors } = useAppTheme();
  const { addTask, data, loading, refresh, toggleTask, updateTask } = usePlanningData();
  const [tab, setTab] = useState<PlanningTab>('All');
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({
    category: 'Guests' as TaskCategory,
    detail: '',
    dueDate: '',
    title: '',
  });
  const completedCount = data.tasks.filter((task) => task.completed).length;
  const progress = data.tasks.length ? (completedCount / data.tasks.length) * 100 : 0;
  const tasks = useMemo(() => data.tasks.filter((task) => tab === 'All' || task.category === tab), [data.tasks, tab]);

  function openTaskForm(taskId?: string) {
    const task = data.tasks.find((item) => item.id === taskId);
    setEditingTaskId(task?.id ?? null);
    setTaskForm({
      category: task?.category ?? (tab === 'All' ? 'Guests' : tab),
      detail: task?.detail ?? '',
      dueDate: task?.dueDate ?? '',
      title: task?.title ?? '',
    });
    setTaskSheetOpen(true);
  }

  function saveTask() {
    if (!taskForm.title.trim() || !taskForm.dueDate.trim()) {
      return;
    }

    const nextTask = {
      category: taskForm.category,
      detail: taskForm.detail.trim() || 'Review and complete this planning item.',
      dueDate: taskForm.dueDate.trim(),
      title: taskForm.title.trim(),
    };

    if (editingTaskId) {
      updateTask(editingTaskId, nextTask);
    } else {
      addTask(nextTask);
    }

    setTaskSheetOpen(false);
  }

  return (
    <Screen onRefresh={refresh} refreshing={loading}>
      <SectionHeader centered subtitle="A calm run-through of the things that need doing next." title="Planning" />

      <Card style={styles.quickAddCard}>
        <View style={styles.quickAddCopy}>
          <Text style={[styles.quickAddTitle, { color: colors.text }]}>Task Command</Text>
          <Text style={[styles.quickAddMeta, { color: colors.muted }]}>Create, categorize, and finish checklist items from your phone.</Text>
        </View>
        <PrimaryButton icon="add" label="Add Task" onPress={() => openTaskForm()} />
      </Card>

      <Card style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={[styles.progressTitle, { color: colors.text }]}>Task Progress</Text>
            <Text style={[styles.progressMeta, { color: colors.muted }]}>
              {completedCount} of {data.tasks.length} complete
            </Text>
          </View>
          <Ionicons color={colors.primary} name="chevron-forward" size={24} />
        </View>
        <ProgressBar value={progress} />
        <Text style={[styles.percent, { color: colors.primary }]}>{Math.round(progress)}% Complete</Text>
      </Card>

      <View style={styles.tabs}>
        {tabs.map((item) => (
          <FilterPill active={tab === item} key={item} label={item} onPress={() => setTab(item)} />
        ))}
      </View>

      {tasks.map((task) => (
        <Card key={task.id} style={styles.taskCard}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.completed }} onPress={() => toggleTask(task.id)} style={styles.taskRow}>
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: task.completed ? colors.primary : colors.cardStrong,
                  borderColor: task.completed ? colors.primary : colors.border,
                },
              ]}
            >
              {task.completed ? <Ionicons color={colors.cardStrong} name="checkmark" size={18} /> : null}
            </View>
            <View style={styles.taskCopy}>
              <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title}</Text>
              <Text style={[styles.taskMeta, { color: colors.muted }]}>
                {task.category} - due {formatShortDate(task.dueDate)}
              </Text>
              <Text style={[styles.taskDetail, { color: colors.muted }]}>{task.detail}</Text>
            </View>
            <Pressable accessibilityLabel={`Edit ${task.title}`} onPress={() => openTaskForm(task.id)}>
              <MaterialCommunityIcons color={colors.accent} name="pencil-circle-outline" size={28} />
            </Pressable>
          </Pressable>
        </Card>
      ))}

      {!tasks.length ? (
        <Card>
          <Text style={[styles.empty, { color: colors.muted }]}>No tasks in this section yet.</Text>
          <View style={styles.emptyAction}>
            <PrimaryButton icon="add" label="Add First Task" onPress={() => openTaskForm()} />
          </View>
        </Card>
      ) : null}

      <FormSheet
        onClose={() => setTaskSheetOpen(false)}
        subtitle="Tasks feed your dashboard progress and keep each wedding workflow moving."
        title={editingTaskId ? 'Edit Task' : 'Add Task'}
        visible={taskSheetOpen}
      >
        <FormField label="Task title" onChangeText={(value) => setTaskForm((current) => ({ ...current, title: value }))} placeholder="Confirm photographer timeline" value={taskForm.title} />
        <FormField label="Due date" onChangeText={(value) => setTaskForm((current) => ({ ...current, dueDate: value }))} placeholder="YYYY-MM-DD" value={taskForm.dueDate} />
        <FormField multiline label="Details" onChangeText={(value) => setTaskForm((current) => ({ ...current, detail: value }))} placeholder="What needs to happen?" value={taskForm.detail} />
        <View style={styles.categoryChoices}>
          {tabs.filter((item): item is TaskCategory => item !== 'All').map((category) => (
            <FilterPill active={taskForm.category === category} key={category} label={category} onPress={() => setTaskForm((current) => ({ ...current, category }))} />
          ))}
        </View>
        <PrimaryButton icon="checkmark-outline" label="Save Task" onPress={saveTask} />
      </FormSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressCard: {
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
  percent: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  taskCard: {
    marginBottom: spacing.md,
  },
  taskRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  checkbox: {
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 2,
    height: 28,
    justifyContent: 'center',
    marginTop: 2,
    width: 28,
  },
  taskCopy: {
    flex: 1,
  },
  taskTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
  },
  taskMeta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 2,
  },
  taskDetail: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  emptyAction: {
    marginTop: spacing.md,
  },
  categoryChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
