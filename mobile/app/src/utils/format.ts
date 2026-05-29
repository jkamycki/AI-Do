export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatShortDate(value?: string) {
  if (!value) {
    return 'Not scheduled';
  }

  const date = parseDate(value);
  if (!date) {
    return 'Not scheduled';
  }

  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export function formatLongDate(value?: string) {
  if (!value) {
    return 'Not scheduled';
  }

  const date = parseDate(value);
  if (!date) {
    return 'Not scheduled';
  }

  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

export function daysUntil(value: string) {
  const target = parseDate(value)?.getTime() ?? Date.now();
  const now = Date.now();
  return Math.max(0, Math.ceil((target - now) / 86400000));
}

export function parseDate(value?: string) {
  if (!value) {
    return null;
  }

  const cleanValue = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(cleanValue)
    ? new Date(`${cleanValue}T12:00:00`)
    : new Date(cleanValue);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function isDateInputValid(value?: string) {
  if (!value?.trim()) {
    return false;
  }

  const cleanValue = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) {
    return false;
  }

  const date = parseDate(cleanValue);
  return Boolean(date && cleanValue === date.toISOString().slice(0, 10));
}

export function daysFromToday(value?: string) {
  const date = parseDate(value);
  if (!date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function formatDeadlineLabel(value?: string) {
  const delta = daysFromToday(value);
  if (delta === null) {
    return 'No deadline';
  }

  if (delta < 0) {
    return `${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} overdue`;
  }

  if (delta === 0) {
    return 'Due today';
  }

  if (delta === 1) {
    return 'Due tomorrow';
  }

  return `Due in ${delta} days`;
}

export function formatMonthYear(value?: string) {
  const date = parseDate(value);
  if (!date) {
    return 'No Deadline Yet';
  }

  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

export function slugifyCoupleName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'our-wedding';
}
