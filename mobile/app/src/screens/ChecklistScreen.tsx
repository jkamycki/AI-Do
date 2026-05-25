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
import { Task, TaskCategory } from '../types';
import { daysFromToday, formatDeadlineLabel, formatMonthYear, formatShortDate, isDateInputValid } from '../utils/format';

type PlanningTab = 'All' | 'Overdue' | 'Due Soon' | TaskCategory;

const tabs: PlanningTab[] = ['All', 'Overdue', 'Due Soon', 'Guests', 'Budget', 'Files', 'Vendors', 'Timeline', 'Website', 'Day Of'];
const taskCategories: TaskCategory[] = ['Guests', 'Budget', 'Files', 'Vendors', 'Checklist', 'Timeline', 'Day Of', 'Website'];

type TaskMonthGroup = {
  key: string;
  label: string;
  tasks: Task[];
};

export function ChecklistScreen() {
  const { colors } = useAppTheme();
  const { addTask, data, deleteTask, loading, refresh, toggleTask, updateTask } = usePlanningData();
  const [tab, setTab] = useState<PlanningTab>('All');
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskError, setTaskError] = useState('');
  const [taskForm, setTaskForm] = useState({
    category: 'Guests' as TaskCategory,
    detail: '',
    dueDate: '',
    title: '',
  });
  const completedCount = data.tasks.filter((task) => task.completed).length;
  const progress = data.tasks.length ? (completedCount / data.tasks.length) * 100 : 0;
  const deadlineTasks = useMemo(() => data.tasks.filter((task) => daysFromToday(task.dueDate) !== null), [data.tasks]);
  const nextDeadline = useMemo(
    () =>
      deadlineTasks
        .filter((task) => !task.completed)
        .sort((a, b) => (daysFromToday(a.dueDate) ?? 9999) - (daysFromToday(b.dueDate) ?? 9999))[0],
    [deadlineTasks],
  );
  const tasks = useMemo(
    () =>
      data.tasks
        .filter((task) => {
          const delta = daysFromToday(task.dueDate);
          if (tab === 'Overdue') {
            return !task.completed && delta !== null && delta < 0;
          }
          if (tab === 'Due Soon') {
            return !task.completed && delta !== null && delta >= 0 && delta <= data.settings.deadlineReminderDays;
          }
          return tab === 'All' || task.category === tab;
        })
        .sort((a, b) => {
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }
          return (daysFromToday(a.dueDate) ?? 9999) - (daysFromToday(b.dueDate) ?? 9999);
        }),
    [data.settings.deadlineReminderDays, data.tasks, tab],
  );
  const taskMonthGroups = useMemo<TaskMonthGroup[]>(() => {
    const groups = new Map<string, TaskMonthGroup>();

    tasks.forEach((task) => {
      const delta = daysFromToday(task.dueDate);
      const key = delta === null ? 'no-deadline' : formatMonthYear(task.dueDate);
      const label = delta === null ? 'No Deadline Yet' : key;
      const existing = groups.get(key);
      if (existing) {
        existing.tasks.push(task);
      } else {
        groups.set(key, { key, label, tasks: [task] });
      }
    });

    return [...groups.values()].sort((a, b) => {
      if (a.key === 'no-deadline') {
        return 1;
      }
      if (b.key === 'no-deadline') {
        return -1;
      }

      return (daysFromToday(a.tasks[0]?.dueDate) ?? 9999) - (daysFromToday(b.tasks[0]?.dueDate) ?? 9999);
    });
  }, [tasks]);

  function openTaskForm(taskId?: string) {
    const task = data.tasks.find((item) => item.id === taskId);
    const category = tab === 'All' || tab === 'Overdue' || tab === 'Due Soon' ? 'Guests' : tab;
    setEditingTaskId(task?.id ?? null);
    setTaskError('');
    setTaskForm({
      category: task?.category ?? category,
      detail: task?.detail ?? '',
      dueDate: task?.dueDate ?? '',
      title: task?.title ?? '',
    });
    setTaskSheetOpen(true);
  }

  function saveTask() {
    if (!taskForm.title.trim()) {
      setTaskError('Add a task title before saving.');
      return;
    }

    if (taskForm.dueDate.trim() && !isDateInputValid(taskForm.dueDate)) {
      setTaskError('Use a valid date in YYYY-MM-DD format.');
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

    setTaskError('');
    setTaskSheetOpen(false);
  }

  function removeTask() {
    if (!editingTaskId) {
      return;
    }

    deleteTask(editingTaskId);
    setTaskSheetOpen(false);
    setEditingTaskId(null);
  }

  return (
    <Screen onRefresh={refresh} refreshing={loading}>
      <SectionHeader centered subtitle="A calm run-through of the things that need doing next." title="Checklist" />

      <Card style={styles.quickAddCard}>
        <View style={styles.quickAddCopy}>
          <Text style={[styles.quickAddTitle, { color: colors.text }]}>Task Command</Text>
          <Text style={[styles.quickAddMeta, { color: colors.muted }]}>Create, categorize, and finish checklist items from your phone.</Text>
        </View>
        <PrimaryButton icon="add" label="Add Task" onPress={() => openTaskForm()} />
      </Card>

      <Card style={styles.reminderCard}>
        <View style={[styles.reminderIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name="notifications-outline" size={23} />
        </View>
        <View style={styles.reminderCopy}>
          <Text style={[styles.reminderTitle, { color: colors.text }]}>Deadline schedule</Text>
          <Text style={[styles.reminderText, { color: colors.muted }]}>
            {data.settings.emailRemindersEnabled
              ? `Email reminders are on ${data.settings.deadlineReminderDays} days before each task deadline.`
              : 'Email reminders are paused in Settings.'}
          </Text>
          <Text style={[styles.reminderNext, { color: colors.primary }]}>
            {nextDeadline ? `${nextDeadline.title}: ${formatDeadlineLabel(nextDeadline.dueDate)}` : `${deadlineTasks.length} tasks have deadlines.`}
          </Text>
        </View>
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

      {taskMonthGroups.map((group) => {
        const completeInMonth = group.tasks.filter((task) => task.completed).length;

        return (
          <View key={group.key} style={styles.monthGroup}>
            <View style={styles.monthHeader}>
              <View>
                <Text style={[styles.monthTitle, { color: colors.text }]}>{group.label}</Text>
                <Text style={[styles.monthMeta, { color: colors.muted }]}>
                  {completeInMonth} of {group.tasks.length} complete
                </Text>
              </View>
              <Text style={[styles.monthCount, { backgroundColor: colors.primarySoft, color: colors.primary }]}>
                {group.tasks.length}
              </Text>
            </View>
            {group.tasks.map((task) => (
              <Card key={task.id} style={styles.taskCard}>
                <View style={styles.taskRow}>
                  <View style={styles.taskCopy}>
                    <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title}</Text>
                    <Text style={[styles.taskMeta, { color: colors.muted }]}>
                      {task.category} - {task.dueDate ? formatShortDate(task.dueDate) : 'No deadline set'}
                    </Text>
                    <Text style={[styles.taskDetail, { color: colors.muted }]}>{task.detail}</Text>
                    <Text
                      style={[
                        styles.deadlineChip,
                        {
                          backgroundColor: (daysFromToday(task.dueDate) ?? 99) < 0 ? colors.accentSoft : colors.primarySoft,
                          color: colors.text,
                        },
                      ]}
                    >
                      {formatDeadlineLabel(task.dueDate)}
                    </Text>
                  </View>
                  <Pressable accessibilityLabel={`Edit ${task.title}`} onPress={() => openTaskForm(task.id)}>
                    <MaterialCommunityIcons color={colors.accent} name="pencil-circle-outline" size={28} />
                  </Pressable>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.completed }} onPress={() => toggleTask(task.id)}>
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
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        );
      })}

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
        <FormField multiline label="Details" onChangeText={(value) => setTaskForm((current) => ({ ...current, detail: value }))} placeholder="What needs to happen?" value={taskForm.detail} />
        <View style={[styles.deadlineSection, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.deadlineSectionTitle, { color: colors.text }]}>Deadline and email reminder</Text>
          <Text style={[styles.deadlineSectionText, { color: colors.muted }]}>
            Add the deadline for this task. Email reminders use your Settings timing and only send for tasks with a date.
          </Text>
          <FormField label="Deadline" onChangeText={(value) => setTaskForm((current) => ({ ...current, dueDate: value }))} placeholder="YYYY-MM-DD" value={taskForm.dueDate} />
        </View>
        <View style={styles.categoryChoices}>
          {taskCategories.map((category) => (
            <FilterPill active={taskForm.category === category} key={category} label={category} onPress={() => setTaskForm((current) => ({ ...current, category }))} />
          ))}
        </View>
        {taskError ? <Text style={[styles.errorText, { color: colors.danger }]}>{taskError}</Text> : null}
        <PrimaryButton icon="checkmark-outline" label="Save Task" onPress={saveTask} />
        {editingTaskId ? <PrimaryButton icon="trash-outline" label="Delete Task" onPress={removeTask} variant="ghost" /> : null}
      </FormSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressCard: {
    marginBottom: spacing.lg,
  },
  deadlineChip: {
    alignSelf: 'flex-start',
    borderRadius: radii.xl,
    fontFamily: fonts.semibold,
    fontSize: 12,
    marginTop: spacing.sm,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  deadlineSection: {
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.md,
  },
  deadlineSectionText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  deadlineSectionTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 20,
  },
  errorText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
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
  reminderCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  reminderCopy: {
    flex: 1,
  },
  reminderIcon: {
    alignItems: 'center',
    borderRadius: radii.lg,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  reminderNext: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  reminderText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  reminderTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 21,
  },
  percent: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  monthCount: {
    borderRadius: radii.xl,
    fontFamily: fonts.bold,
    fontSize: 13,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  monthGroup: {
    marginBottom: spacing.xl,
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  monthTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 25,
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
