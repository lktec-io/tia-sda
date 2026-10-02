import { useEffect, useId, useRef, useState } from 'react';
import { CalendarIcon, ClockIcon, CloseIcon, ExpandIcon, UserIcon } from './Icons';
import { categorySwahili, latestUpdateLabel, swahiliLabels } from '../data/siteContent';
import { cloudinaryFit } from '../lib/cloudinary';
import { effectiveDate, issuerOf } from '../utils/announcements';
import { formatLongDate, toDate } from '../utils/format';

/**
 * Centered, landscape announcement viewer.
 * Left: the event poster — always shown whole (object-fit: contain, never cropped)
 * over a blurred fill of itself — with a "View full poster" button that opens it in
 * an immersive full-screen viewer. Right: title, Swahili sub-labels, the issuing
 * office, "Imetumwa Lini" / "Tarehe ya Tukio" dates and the full text.
 * Esc closes the poster viewer first, then the modal; focus returns to the opener.
 */
export default function AnnouncementModal({ announcement, onClose }) {
  const titleId = useId();
  const closeRef = useRef(null);
  const zoomCloseRef = useRef(null);
  const [posterFailed, setPosterFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const zoomedRef = useRef(false);

  useEffect(() => {
    zoomedRef.current = zoomed;
    if (zoomed) zoomCloseRef.current?.focus();
  }, [zoomed]);

  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (zoomedRef.current) {
        setZoomed(false);
        closeRef.current?.focus();
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  const category = announcement.category || 'General';
  const sent = effectiveDate(announcement);
  const eventDate = toDate(announcement.eventDate);
  const updatedDate = toDate(announcement.updatedAt);
  const poster = announcement.imageUrl && !posterFailed ? cloudinaryFit(announcement.imageUrl, 1400) : '';
  const fullPoster = announcement.imageUrl && !posterFailed ? cloudinaryFit(announcement.imageUrl, 2400) : '';
  const title = announcement.title || 'Untitled announcement';

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
              <img src={poster} alt={`Poster: ${title}`} onError={() => setPosterFailed(true)} />
              <button type="button" className="ann-modal-zoom" onClick={() => setZoomed(true)}>
                <ExpandIcon width={15} height={15} />
                <span>View full poster</span>
              </button>
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

          <h2 id={titleId} className="ann-modal-title">{title}</h2>

          <div className="ann-modal-meta">
            <span>
              <UserIcon width={15} height={15} />
              {issuerOf(announcement)}
            </span>
            {updatedDate && <span className="ann-modal-updated">Updated {formatLongDate(announcement.updatedAt)}</span>}
          </div>

          <dl className="ann-modal-dates">
            <div>
              <dt>
                <ClockIcon width={14} height={14} />
                <span lang="sw">Imetumwa Lini</span>
              </dt>
              <dd>
                <time dateTime={sent ? sent.toISOString() : undefined}>{formatLongDate(sent, 'Date not set')}</time>
              </dd>
            </div>
            {eventDate && (
              <div className="is-event">
                <dt>
                  <CalendarIcon width={14} height={14} />
                  <span lang="sw">Tarehe ya Tukio</span>
                </dt>
                <dd>
                  <time dateTime={eventDate.toISOString()}>{formatLongDate(eventDate)}</time>
                </dd>
              </div>
            )}
          </dl>

          <div className="ann-modal-body">{announcement.content}</div>
        </div>
      </div>

      {/* Immersive poster viewer: whole image, full proportion, nothing cropped. */}
      {zoomed && fullPoster && (
        <div
          className="ann-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Full poster: ${title}`}
          onMouseDown={(e) => {
            e.stopPropagation();
            setZoomed(false);
          }}
        >
          <button
            type="button"
            ref={zoomCloseRef}
            className="ann-modal-close ann-lightbox-close"
            onClick={() => setZoomed(false)}
            aria-label="Close full poster"
          >
            <CloseIcon width={20} height={20} />
          </button>
          <figure className="ann-lightbox-frame" onMouseDown={(e) => e.stopPropagation()}>
            <img src={fullPoster} alt={`Poster: ${title}`} />
            <figcaption>{title}</figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
