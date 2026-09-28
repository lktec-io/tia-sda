// Accepts a Firestore Timestamp, Date, ISO string or millis and returns a Date (or null).
export const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const toMillis = (value) => toDate(value)?.getTime() ?? 0;

export const formatDate = (value, fallback = 'Date not set') => {
  const date = toDate(value);
  return date
    ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : fallback;
};

export const formatLongDate = (value, fallback = '—') => {
  const date = toDate(value);
  return date
    ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : fallback;
};

export const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
};

export const titleCase = (value = '') =>
  value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
