import { mobileAuthJson } from './mobileAuth';

export type SeatingGuestPayload = {
  avoidIds?: string[];
  group: string;
  id: string;
  name: string;
  notes?: string;
  plusOne: boolean;
  plusOneName?: string;
  preferIds?: string[];
};

export type SeatingTablePayload = {
  guests: string[];
  tableName: string;
  tableNumber: number;
  theme?: string;
};

export type SeatingResultPayload = {
  insights: string[];
  tables: SeatingTablePayload[];
  totalSeated: number;
  warnings: string[];
};

export type SavedSeatingChartPayload = {
  id: number;
};

async function seatingFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return mobileAuthJson<T>(`/api${path}`, init);
}

export function generateSeatingChart(payload: {
  additionalNotes?: string;
  guests: SeatingGuestPayload[];
  language?: string;
  seatsPerTable: number;
  tableCount: number;
}) {
  return seatingFetch<SeatingResultPayload>('/seating/generate', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function saveSeatingChart(payload: {
  guests: SeatingGuestPayload[];
  name: string;
  seatsPerTable: number;
  tableCount: number;
  tables: SeatingTablePayload[];
}) {
  return seatingFetch<SavedSeatingChartPayload>('/seating/charts', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

export function updateSeatingChart(id: number, payload: {
  guests: SeatingGuestPayload[];
  name: string;
  seatsPerTable: number;
  tableCount: number;
  tables: SeatingTablePayload[];
}) {
  return seatingFetch<SavedSeatingChartPayload>(`/seating/charts/${id}`, {
    body: JSON.stringify(payload),
    method: 'PUT',
  });
}

export function applySeatingChart(id: number) {
  return seatingFetch<{ applied: number; success: boolean }>(`/seating/charts/${id}/apply`, {
    method: 'POST',
  });
}
