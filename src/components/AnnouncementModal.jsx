import { useEffect, useId, useRef, useState } from 'react';
import { CalendarIcon, CloseIcon, UserIcon } from './Icons';
import { categorySwahili, latestUpdateLabel, swahiliLabels } from '../data/siteContent';
import { cloudinaryFit } from '../lib/cloudinary';
import { formatLongDate, toDate } from '../utils/format';

/**
 * Centered, landscape announcement viewer.
 * Left: the event poster (whole image over a blurred fill of itself) or a gradient.
 * Right: title, Swahili sub-labels, publisher details and the full text.
 * Closes on the X button, the Esc key, or a click on the frosted backdrop, and
 * returns keyboard focus to the card that opened it.
 */
export default function AnnouncementModal({ announcement, onClose }) {
  const titleId = useId();
  const closeRef = useRef(null);
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  const category = announcement.category || 'General';
  const published = announcement.publishedAt || announcement.createdAt;
  const publishedDate = toDate(published);
  const updatedDate = toDate(announcement.updatedAt);
  const poster = announcement.imageUrl && !posterFailed ? cloudinaryFit(announcement.imageUrl, 1400) : '';

  return (
    <div className="ann-modal-backdrop" onMouseDown={onClose}>
      <div
        className="ann-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" ref={closeRef} className="ann-modal-close" onClick={onClose} aria-label="Close announcement">
          <CloseIcon width={20} height={20} />
        </button>

        <div className={`ann-modal-media ${poster ? 'has-image' : ''}`}>
          {poster ? (
            <>
              <span className="ann-modal-media-fill" style={{ backgroundImage: `url('${poster}')` }} aria-hidden="true" />
              <img src={poster} alt={`Poster: ${announcement.title || 'announcement'}`} onError={() => setPosterFailed(true)} />
            </>
          ) : (
            <span className="ann-modal-media-fallback" aria-hidden="true">
              <CalendarIcon width={40} height={40} />
              <span>{category}</span>
              <em lang="sw">{categorySwahili[category] || swahiliLabels.announcements}</em>
            </span>
          )}
        </div>

        <div className="ann-modal-content">
          <div className="ann-modal-tags">
            {announcement.isNew && (
              <span className="ann-modal-new">
                <span className="pulse-dot" aria-hidden="true" />
                {latestUpdateLabel}
              </span>
            )}
            <span className="badge badge-gold">{category}</span>
          </div>

          <span className="ann-modal-eyebrow" lang="sw">
            {swahiliLabels.announcements}
            {categorySwahili[category] ? ` · ${categorySwahili[category]}` : ''}
          </span>

          <h2 id={titleId} className="ann-modal-title">{announcement.title || 'Untitled announcement'}</h2>

          <div className="ann-modal-meta">
            <span>
              <UserIcon width={15} height={15} />
              {announcement.authorName || 'TUCASA Leadership'}
            </span>
            <time dateTime={publishedDate ? publishedDate.toISOString() : undefined}>
              <CalendarIcon width={15} height={15} />
              {formatLongDate(published, 'Date not set')}
            </time>
            {updatedDate && <span className="ann-modal-updated">Updated {formatLongDate(announcement.updatedAt)}</span>}
          </div>

          <div className="ann-modal-body">{announcement.content}</div>
        </div>
      </div>
    </div>
  );
}
