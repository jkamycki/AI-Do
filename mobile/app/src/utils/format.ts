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
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function daysUntil(value: string) {
  const target = new Date(value).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((target - now) / 86400000));
}
