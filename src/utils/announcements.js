import { toDate, toMillis } from './format';

/**
 * When a post "goes out": its scheduled time if one was set, otherwise publishedAt.
 * Used for sorting, "new in the last 48 h" alerts and display dates.
 */
export const effectiveMillis = (a) => toMillis(a?.scheduledAt) || toMillis(a?.publishedAt) || toMillis(a?.createdAt);

export const effectiveDate = (a) => toDate(a?.scheduledAt) || toDate(a?.publishedAt) || toDate(a?.createdAt);

/**
 * Publication state at time `now` (ms):
 *  'scheduled' — scheduledAt is still in the future
 *  'expired'   — expiresAt has passed
 *  'live'      — visible to its audience
 */
export function announcementState(a, now) {
  const scheduled = toMillis(a?.scheduledAt);
  const expires = toMillis(a?.expiresAt);
  if (scheduled && scheduled > now) return 'scheduled';
  if (expires && expires <= now) return 'expired';
  return 'live';
}

export const isAnnouncementLive = (a, now) => announcementState(a, now) === 'live';

export const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Live and went out within the last 48 hours. */
export const isRecentAnnouncement = (a, now) =>
  isAnnouncementLive(a, now) && now - effectiveMillis(a) <= RECENT_WINDOW_MS;
