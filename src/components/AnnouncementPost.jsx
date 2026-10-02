import { useState } from 'react';
import { CalendarIcon, ChevronDownIcon, ClockIcon, UserIcon } from './Icons';
import { CATEGORY_CLASS, ROLE_LABELS } from '../data/constants';
import { cloudinaryBanner, cloudinaryThumb } from '../lib/cloudinary';
import { announcementState, effectiveDate, issuerOf } from '../utils/announcements';
import { formatDate, formatDateTime, formatLongDate, toDate } from '../utils/format';

/** "Imetumwa Lini" (sent) and, when set, "Tarehe ya Tukio" (event date) lines. */
export function AnnouncementDates({ announcement, className = 'post-dates' }) {
  const sent = effectiveDate(announcement);
  const event = toDate(announcement.eventDate);
  return (
    <dl className={className}>
      <div>
        <dt>
          <ClockIcon width={13} height={13} />
          <span lang="sw">Imetumwa Lini:</span>
        </dt>
        <dd>
          <time dateTime={sent ? sent.toISOString() : undefined}>{formatDate(sent)}</time>
        </dd>
      </div>
      {event && (
        <div className="is-event">
          <dt>
            <CalendarIcon width={13} height={13} />
            <span lang="sw">Tarehe ya Tukio:</span>
          </dt>
          <dd>
            <time dateTime={event.toISOString()}>{formatLongDate(event)}</time>
          </dd>
        </div>
      )}
    </dl>
  );
}

/**
 * Announcement in the portal (member feed, leader lists, publisher preview).
 * - layout 'card' (default): full card with poster (hidden when `compact`).
 * - layout 'row': compact full-width row — thumbnail, title, dates and a two-line
 *   excerpt that expands in place ("Read more"), for scanning long feeds quickly.
 * `actions` renders extra controls (Edit / Delete). `showSchedule` + `now` (leader
 * views) add a Scheduled / Live / Expired chip.
 */
export default function AnnouncementPost({
  announcement,
  showAudience = false,
  compact = false,
  actions = null,
  showSchedule = false,
  now = null,
  layout = 'card'
}) {
  const [expanded, setExpanded] = useState(false);
  const category = announcement.category || 'General';
  const scheduleState = showSchedule && now ? announcementState(announcement, now) : null;
  const hasTiming = Boolean(announcement.scheduledAt || announcement.expiresAt);
  const audience = Array.isArray(announcement.visibleTo) ? announcement.visibleTo : [];
  const isRow = layout === 'row';
  const showPoster = !isRow && !compact && Boolean(announcement.imageUrl);
  const title = announcement.title || 'Untitled announcement';

  const scheduleChip = scheduleState && hasTiming && (
    <span className={`schedule-chip schedule-${scheduleState}`}>
      <ClockIcon width={13} height={13} />
      {scheduleState === 'scheduled' && `Scheduled · ${formatDateTime(effectiveDate(announcement))}`}
      {scheduleState === 'live' && (announcement.expiresAt ? `Live · expires ${formatDateTime(announcement.expiresAt)}` : 'Live')}
      {scheduleState === 'expired' && 'Expired · hidden from members'}
    </span>
  );

  const footer = ((showAudience && audience.length > 0) || actions) && (
    <footer className="post-audience">
      {showAudience && audience.length > 0 && (
        <>
          <span>Visible to:</span>
          {audience.map((tag) => (
            <span key={tag} className="badge">{ROLE_LABELS[tag] || tag}</span>
          ))}
        </>
      )}
      {actions && <span className="post-actions">{actions}</span>}
    </footer>
  );

  if (isRow) {
    return (
      <article className={`post post-row ${expanded ? 'is-expanded' : ''}`.trim()}>
        <span className={`post-row-thumb ${announcement.imageUrl ? 'has-image' : ''}`}>
          {announcement.imageUrl ? (
            <img src={cloudinaryThumb(announcement.imageUrl, 160)} alt="" loading="lazy" decoding="async" />
          ) : (
            <CalendarIcon width={18} height={18} />
          )}
        </span>

        <div className="post-row-main">
          <div className="post-row-top">
            <span className={`cat-badge ${CATEGORY_CLASS[category] || 'cat-general'}`}>{category}</span>
            {scheduleChip}
            <span className="post-row-issuer">
              <UserIcon width={13} height={13} />
              {issuerOf(announcement)}
            </span>
          </div>
          <h3 className="post-title">{title}</h3>
          <AnnouncementDates announcement={announcement} className="post-dates post-dates-inline" />
          <p className="post-body">{announcement.content}</p>
          {(announcement.content || '').length > 140 && (
            <button
              type="button"
              className="post-row-more"
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? 'Show less' : 'Read more'}
              <ChevronDownIcon width={15} height={15} />
            </button>
          )}
          {footer}
        </div>
      </article>
    );
  }

  return (
    <article className={`post ${compact ? 'post-compact' : ''} ${showPoster ? 'has-poster' : ''}`.trim()}>
      {showPoster && (
        <div className="post-poster">
          <img src={cloudinaryBanner(announcement.imageUrl, 900)} alt="" loading="lazy" decoding="async" />
        </div>
      )}

      <header className="post-head">
        <span className={`cat-badge ${CATEGORY_CLASS[category] || 'cat-general'}`}>{category}</span>
        <div className="post-meta">
          {scheduleChip}
          <span>
            <UserIcon width={15} height={15} />
            {issuerOf(announcement)}
          </span>
        </div>
      </header>

      <h3 className="post-title">{title}</h3>
      <AnnouncementDates announcement={announcement} />
      <p className="post-body">{announcement.content}</p>

      {footer}
    </article>
  );
}
