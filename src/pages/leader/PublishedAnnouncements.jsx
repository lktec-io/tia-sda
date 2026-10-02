import { Link } from 'react-router-dom';
import useRoleAnnouncements from '../../hooks/useRoleAnnouncements';
import Alert from '../../components/Alert';
import { CalendarIcon, FileIcon, MegaphoneIcon } from '../../components/Icons';
import { CATEGORY_CLASS, ROLE_LABELS } from '../../data/constants';
import { cloudinaryBanner } from '../../lib/cloudinary';
import { formatDate } from '../../utils/format';
import { announcementState, effectiveDate } from '../../utils/announcements';

const STATE_LABEL = { scheduled: 'Scheduled', expired: 'Expired' };

const MAX_ROWS = 8;

/**
 * Command Center panel listing published announcements, each with an
 * "Edit Poster/Post" control that opens the publisher in Edit Mode.
 */
export default function PublishedAnnouncements() {
  const { announcements, status, retry, now } = useRoleAnnouncements();
  const rows = announcements.slice(0, MAX_ROWS);

  return (
    <section className="panel published-panel">
      <div className="panel-head">
        <h3>
          <MegaphoneIcon width={18} height={18} />
          Published Announcements
        </h3>
        <Link to="/leader/publish" className="btn btn-primary btn-sm">
          <MegaphoneIcon width={16} height={16} />
          New Announcement
        </Link>
      </div>

      {status === 'loading' && (
        <div className="panel-loading">
          <span className="spinner" />
          <span>Loading announcements...</span>
        </div>
      )}

      {status === 'error' && (
        <Alert type="error">
          Announcements could not be loaded.{' '}
          <button type="button" className="btn-link" onClick={retry}>Retry</button>
        </Alert>
      )}

      {status === 'ready' && rows.length === 0 && (
        <div className="empty-state">
          <MegaphoneIcon width={26} height={26} />
          <p>No announcements have been published yet.</p>
        </div>
      )}

      {status === 'ready' && rows.length > 0 && (
        <ul className="published-list">
          {rows.map((item) => {
            const category = item.category || 'General';
            const audience = Array.isArray(item.visibleTo) ? item.visibleTo : [];
            const state = now ? announcementState(item, now) : 'live';
            return (
              <li key={item.id} className="published-item">
                <span className={`published-thumb ${item.imageUrl ? 'has-image' : ''}`}>
                  {item.imageUrl ? (
                    <img src={cloudinaryBanner(item.imageUrl, 240)} alt="" loading="lazy" />
                  ) : (
                    <MegaphoneIcon width={18} height={18} />
                  )}
                </span>

                <span className="published-info">
                  <strong>{item.title || 'Untitled announcement'}</strong>
                  <span className="published-meta">
                    <span className={`cat-badge ${CATEGORY_CLASS[category] || 'cat-general'}`}>{category}</span>
                    <span className="published-date">
                      <CalendarIcon width={13} height={13} />
                      {formatDate(effectiveDate(item))}
                    </span>
                    {state !== 'live' && (
                      <span className={`schedule-chip schedule-${state}`}>{STATE_LABEL[state]}</span>
                    )}
                    <span className="published-audience">
                      {audience.map((tag) => ROLE_LABELS[tag] || tag).join(' · ') || '—'}
                    </span>
                  </span>
                </span>

                <Link
                  to={`/leader/publish/${item.id}`}
                  className="icon-btn published-edit"
                  aria-label={`Edit poster or post: ${item.title || 'untitled announcement'}`}
                  title="Edit Poster/Post"
                >
                  <FileIcon width={17} height={17} />
                  <span className="published-edit-text">Edit Poster/Post</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {status === 'ready' && announcements.length > MAX_ROWS && (
        <p className="published-more">
          Showing the {MAX_ROWS} most recent of {announcements.length}. Older posts can be edited from{' '}
          <Link to="/leader/publish" className="btn-link">the publisher</Link>.
        </p>
      )}
    </section>
  );
}
