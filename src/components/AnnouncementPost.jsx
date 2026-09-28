import { CalendarIcon, UserIcon } from './Icons';
import { CATEGORY_CLASS, ROLE_LABELS } from '../data/constants';
import { formatDate, toDate } from '../utils/format';

// Full-text announcement card used inside the portal (member feed + leader recent posts).
export default function AnnouncementPost({ announcement, showAudience = false, compact = false }) {
  const category = announcement.category || 'General';
  const published = toDate(announcement.publishedAt);
  const audience = Array.isArray(announcement.visibleTo) ? announcement.visibleTo : [];

  return (
    <article className={`post ${compact ? 'post-compact' : ''}`}>
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

      {showAudience && audience.length > 0 && (
        <footer className="post-audience">
          <span>Visible to:</span>
          {audience.map((tag) => (
            <span key={tag} className="badge">{ROLE_LABELS[tag] || tag}</span>
          ))}
        </footer>
      )}
    </article>
  );
}
