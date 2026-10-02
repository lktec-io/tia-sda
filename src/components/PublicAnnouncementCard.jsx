import { useState } from 'react';
import { ArrowRightIcon, CalendarIcon, ChurchIcon } from './Icons';
import { categorySwahili, latestUpdateLabel } from '../data/siteContent';
import { cloudinaryBanner } from '../lib/cloudinary';
import { formatDate, toDate } from '../utils/format';
import '../styles/announcement-card.css';

const EXCERPT_LENGTH = 160;

const truncate = (text = '', length = EXCERPT_LENGTH) =>
  text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;

// 16:9 cinematic poster, or a glowing abstract church gradient with a vector icon.
function PosterCanvas({ imageUrl, category }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const showImage = imageUrl && failedUrl !== imageUrl;

  return (
    <div className={`announcement-poster ${showImage ? 'has-image' : ''}`}>
      {showImage ? (
        <img
          src={imageUrl.startsWith('blob:') ? imageUrl : cloudinaryBanner(imageUrl, 800)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <span className="announcement-poster-fallback" aria-hidden="true">
          <span className="poster-orb poster-orb-gold" />
          <span className="poster-orb poster-orb-blue" />
          <span className="poster-icon">
            <ChurchIcon width={34} height={34} />
          </span>
          <span className="poster-category">{category}</span>
        </span>
      )}
    </div>
  );
}

/**
 * Public announcement card — dark frosted glass, 16:9 poster, "Latest update" chip.
 * Used on the homepage (clickable via `onOpen`) and as the publisher's live preview
 * (no `onOpen` → static), so both render exactly the same canvas.
 */
export default function PublicAnnouncementCard({ announcement, onOpen }) {
  const content = announcement.content || '';
  const published = announcement.publishedAt || announcement.createdAt;
  const publishedDate = toDate(published);
  const category = announcement.category || 'General';
  const clickable = typeof onOpen === 'function';
  const title = announcement.title || 'Untitled announcement';

  return (
    <article
      className={['announcement-card', 'public-announcement-card', announcement.isNew ? 'is-new' : '', clickable ? 'is-clickable' : '']
        .filter(Boolean)
        .join(' ')}
    >
      {announcement.isNew && (
        <span className="new-chip">
          <span className="pulse-dot" aria-hidden="true" />
          {latestUpdateLabel}
        </span>
      )}

      <PosterCanvas imageUrl={announcement.imageUrl} category={category} />

      <div className="announcement-body">
        <div className="announcement-top">
          <span className="announcement-badge">
            {category}
            {categorySwahili[category] && <em lang="sw"> · {categorySwahili[category]}</em>}
          </span>
          <time className="announcement-date" dateTime={publishedDate ? publishedDate.toISOString() : undefined}>
            <CalendarIcon width={15} height={15} />
            {formatDate(published)}
          </time>
        </div>

        <h3>
          {clickable ? (
            <button type="button" className="announcement-open" onClick={() => onOpen(announcement)} aria-haspopup="dialog">
              {title}
            </button>
          ) : (
            title
          )}
        </h3>

        <p>{truncate(content)}</p>

        {clickable && (
          <span className="announcement-more" aria-hidden="true">
            Read full announcement <ArrowRightIcon width={15} height={15} />
          </span>
        )}
      </div>
    </article>
  );
}
