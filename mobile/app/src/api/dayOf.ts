import type { DayOfEvent } from '../types';
import { mobileAuthFetch } from './mobileAuth';

type TimelineEventRecord = {
  completed?: boolean;
  id?: number | string;
  location?: string;
  notes?: string;
  status?: string;
  title?: string;
};

type TimelineResponse = {
  events?: TimelineEventRecord[];
  id?: number | string;
};

function matchesEvent(record: TimelineEventRecord, event: DayOfEvent) {
  if (record.id != null && String(record.id) === event.id) return true;
  return String(record.title ?? '').trim() === event.title.trim() && String(record.location ?? '').trim() === event.location.trim();
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.error || body.message || 'Timeline sync failed.';
  } catch {
    return 'Timeline sync failed.';
  }
}

export async function syncDayOfEventCompletion(event: DayOfEvent, completed: boolean): Promise<{ synced: boolean }> {
  const timelineResponse = await mobileAuthFetch('/api/timeline');
  if (!timelineResponse) return { synced: false };
  if (timelineResponse.status === 404) return { synced: false };
  if (!timelineResponse.ok) throw new Error(await readError(timelineResponse));

  const timeline = (await timelineResponse.json()) as TimelineResponse;
  const timelineId = timeline.id;
  const events = Array.isArray(timeline.events) ? timeline.events : [];
  if (timelineId == null || !events.length) return { synced: false };

  let found = false;
  const nextEvents = events.map((record) => {
    if (!matchesEvent(record, event)) return record;
    found = true;
    return {
      ...record,
      completed,
      status: completed ? 'Complete' : 'Pending',
    };
  });

  if (!found) return { synced: false };

  const patchResponse = await mobileAuthFetch(`/api/timeline/${timelineId}`, {
    body: JSON.stringify({ events: nextEvents }),
    method: 'PATCH',
  });
  if (!patchResponse) return { synced: false };
  if (!patchResponse.ok) throw new Error(await readError(patchResponse));
  return { synced: true };
}
