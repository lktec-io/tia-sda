import { CalendarIcon, UserIcon } from './Icons';
import { CATEGORY_CLASS, ROLE_LABELS } from '../data/constants';
import { cloudinaryBanner } from '../lib/cloudinary';
import { formatDate, toDate } from '../utils/format';

/**
 * Full-text announcement card used inside the portal (member feed, leader lists, preview).
 * Shows the event poster on top when `imageUrl` is set (hidden in compact mode).
 * `actions` renders extra controls (e.g. an Edit button) in the card footer.
 */
export default function AnnouncementPost({ announcement, showAudience = false, compact = false, actions = null }) {
  const category = announcement.category || 'General';
  const published = toDate(announcement.publishedAt);
  const audience = Array.isArray(announcement.visibleTo) ? announcement.visibleTo : [];
  const showPoster = !compact && Boolean(announcement.imageUrl);

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
          <time dateTime={published ? published.toISOString() : undefined}>
            <CalendarIcon width={15} height={15} />
            {formatDate(announcement.publishedAt)}
          </time>
          <span>
            <UserIcon width={15} height={15} />
            {announcement.authorName || 'TUCASA Leadership'}
          </span>
        </div>
      </header>

      <h3 className="post-title">{announcement.title || 'Untitled announcement'}</h3>
      <p className="post-body">{announcement.content}</p>

      {((showAudience && audience.length > 0) || actions) && (
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
      )}
    </article>
  );
}
