import AsyncStorage from '@react-native-async-storage/async-storage';

import { DayOfChecklistItem } from '../types';
import { mobileAuthFetch, mobileAuthJson } from './mobileAuth';

const DAY_OF_CHECKLIST_MAP_KEY = 'aido.mobile.dayOfChecklistBackendIds';

type ChecklistResponse = {
  id: number;
  isCompleted: boolean;
};

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
  const backendId = Number(taskId);
  if (!Number.isInteger(backendId) || backendId <= 0) {
    return { synced: false, reason: 'local-only-task' as const };
  }

  const response = await mobileAuthFetch(`/api/checklist/items/${backendId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isCompleted: completed }),
  });
  if (!response) return { synced: false, reason: 'auth-unavailable' as const };
  if (!response.ok) throw new Error('Could not sync checklist item.');
  return { synced: true as const };
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
