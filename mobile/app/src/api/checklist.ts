import AsyncStorage from '@react-native-async-storage/async-storage';

import { DayOfChecklistItem, Task } from '../types';
import { mobileAuthFetch, mobileAuthJson } from './mobileAuth';

const DAY_OF_CHECKLIST_MAP_KEY = 'aido.mobile.dayOfChecklistBackendIds';

type ChecklistResponse = {
  description?: string | null;
  dueDate?: string | null;
  id: number;
  isCompleted: boolean;
  month?: string | null;
  task?: string | null;
};

type TaskSyncResult = {
  synced: boolean;
  task?: Task;
};

function isBackendId(id: string) {
  return /^\d+$/.test(id);
}

function taskCategoryFromMonth(month?: string | null): Task['category'] {
  const value = String(month ?? '').trim();
  if (value === 'Guests' || value === 'Budget' || value === 'Files' || value === 'Vendors' || value === 'Checklist' || value === 'Timeline' || value === 'Day Of' || value === 'Website') {
    return value;
  }
  return 'Checklist';
}

function taskPayload(task: Omit<Task, 'id'> | Task) {
  return {
    description: task.detail.trim() || 'Review and complete this planning item.',
    dueDate: task.dueDate.trim() || null,
    month: task.category,
    task: task.title.trim(),
  };
}

function toMobileTask(item: ChecklistResponse, fallback?: Task): Task {
  return {
    category: taskCategoryFromMonth(item.month) || fallback?.category || 'Checklist',
    completed: Boolean(item.isCompleted ?? fallback?.completed),
    detail: item.description?.trim() || fallback?.detail || 'Review and complete this planning item.',
    dueDate: item.dueDate || fallback?.dueDate || '',
    id: String(item.id ?? fallback?.id ?? `task-${Date.now()}`),
    title: item.task?.trim() || fallback?.title || 'Checklist task',
  };
}

async function readChecklistError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.error || body.message || 'Checklist sync failed.';
  } catch {
    return 'Checklist sync failed.';
  }
}

async function readDayOfMap(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(DAY_OF_CHECKLIST_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveDayOfMap(map: Record<string, number>) {
  await AsyncStorage.setItem(DAY_OF_CHECKLIST_MAP_KEY, JSON.stringify(map));
}

export async function syncTaskCompletion(taskId: string, completed: boolean) {
  if (!isBackendId(taskId)) {
    return { synced: false, reason: 'local-only-task' as const };
  }

  const response = await mobileAuthFetch(`/api/checklist/items/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isCompleted: completed }),
  });
  if (!response) return { synced: false, reason: 'auth-unavailable' as const };
  if (!response.ok) throw new Error('Could not sync checklist item.');
  return { synced: true as const };
}

export async function createMobileTask(task: Omit<Task, 'id'> | Task): Promise<TaskSyncResult> {
  const response = await mobileAuthFetch('/api/checklist/items', {
    method: 'POST',
    body: JSON.stringify(taskPayload(task)),
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readChecklistError(response));
  return { synced: true, task: toMobileTask((await response.json()) as ChecklistResponse, 'id' in task ? task : undefined) };
}

export async function updateMobileTask(task: Task): Promise<TaskSyncResult> {
  if (!isBackendId(task.id)) return { synced: false };
  const response = await mobileAuthFetch(`/api/checklist/items/${task.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...taskPayload(task),
      isCompleted: task.completed,
    }),
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readChecklistError(response));
  return { synced: true, task: toMobileTask((await response.json()) as ChecklistResponse, task) };
}

export async function deleteMobileTask(taskId: string): Promise<{ synced: boolean }> {
  if (!isBackendId(taskId)) return { synced: false };
  const response = await mobileAuthFetch(`/api/checklist/items/${taskId}`, { method: 'DELETE' });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readChecklistError(response));
  return { synced: true };
}

export async function syncDayOfChecklistCompletion(item: DayOfChecklistItem, completed: boolean, weddingDate: string) {
  const authProbe = await mobileAuthFetch('/api/profile');
  if (!authProbe) return { synced: false, reason: 'auth-unavailable' as const };
  if (!authProbe.ok) throw new Error('Could not verify backend sync.');

  const map = await readDayOfMap();
  let backendId = map[item.id];

  if (!backendId) {
    const created = await mobileAuthJson<ChecklistResponse>('/api/checklist/items', {
      method: 'POST',
      body: JSON.stringify({
        description: item.note || item.category,
        dueDate: weddingDate.slice(0, 10),
        month: 'Wedding Day',
        task: item.title,
      }),
    });
    backendId = created.id;
    await saveDayOfMap({ ...map, [item.id]: backendId });
  }

  await mobileAuthJson<ChecklistResponse>(`/api/checklist/items/${backendId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isCompleted: completed }),
  });
  return { synced: true as const };
}
