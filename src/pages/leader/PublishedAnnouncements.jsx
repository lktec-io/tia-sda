import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useRoleAnnouncements from '../../hooks/useRoleAnnouncements';
import useAnnouncementDeletion from '../../hooks/useAnnouncementDeletion';
import Alert from '../../components/Alert';
import { CalendarIcon, FileIcon, MegaphoneIcon, SearchIcon, TrashIcon } from '../../components/Icons';
import { CATEGORY_CLASS, ROLE_LABELS } from '../../data/constants';
import { cloudinaryBanner } from '../../lib/cloudinary';
import { formatDate } from '../../utils/format';
import { announcementState, effectiveDate, issuerOf } from '../../utils/announcements';

const MAX_ROWS = 8;
const STATE_LABEL = { scheduled: 'Scheduled', expired: 'Expired' };

/**
 * Command Center panel listing published announcements with live search and
 * "Edit" + "Delete" controls (delete asks for confirmation first).
 */
export default function PublishedAnnouncements() {
  const { announcements, status, retry, now } = useRoleAnnouncements();
  const { requestDelete, dialog, notice } = useAnnouncementDeletion();
  const [search, setSearch] = useState('');

  const matching = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return announcements;
    return announcements.filter((item) =>
      [item.title, item.content, item.category, item.issuedBy].filter(Boolean).some((v) => v.toLowerCase().includes(term))
    );
  }, [announcements, search]);
  const rows = matching.slice(0, MAX_ROWS);

  return (
    <section className="panel published-panel">
      <div className="panel-head">
        <h3>
          <MegaphoneIcon width={18} height={18} />
          Published Announcements
        </h3>
        <Link to="/leader/publish" className="btn btn-primary btn-sm">
          <MegaphoneIcon width={16} height={16} />
          <span>New Announcement</span>
        </Link>
      </div>

      <div className="list-toolbar published-toolbar">
        <label className="toolbar-search">
          <SearchIcon width={17} height={17} />
          <span className="sr-only">Search published announcements</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search announcements..."
          />
        </label>
      </div>

      {notice.text && <Alert type={notice.type}>{notice.text}</Alert>}

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
          <p>{search.trim() ? `No announcements match "${search.trim()}".` : 'No announcements have been published yet.'}</p>
        </div>
      )}

      {status === 'ready' && rows.length > 0 && (
        <ul className="published-list">
          {rows.map((item) => {
            const category = item.category || 'General';
            const audience = Array.isArray(item.visibleTo) ? item.visibleTo : [];
            const state = now ? announcementState(item, now) : 'live';
            const title = item.title || 'Untitled announcement';
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
                  <strong>{title}</strong>
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
                      {issuerOf(item)} · {audience.map((tag) => ROLE_LABELS[tag] || tag).join(' · ') || '—'}
                    </span>
                  </span>
                </span>

                <span className="published-actions">
                  <Link
                    to={`/leader/publish/${item.id}`}
                    className="icon-btn published-edit"
                    aria-label={`Edit poster or post: ${title}`}
                    title="Edit Poster/Post"
                  >
                    <FileIcon width={17} height={17} />
                    <span className="published-edit-text">Edit</span>
                  </Link>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    onClick={() => requestDelete(item)}
                    aria-label={`Delete announcement: ${title}`}
                    title="Delete announcement"
                  >
                    <TrashIcon width={17} height={17} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {status === 'ready' && matching.length > MAX_ROWS && (
        <p className="published-more">
          Showing the {MAX_ROWS} most recent of {matching.length}. See every post in{' '}
          <Link to="/dashboard/announcements" className="btn-link">Internal Announcements</Link>.
        </p>
      )}

      {dialog}
    </section>
  );
}
