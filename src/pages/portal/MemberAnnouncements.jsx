import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useRoleAnnouncements from '../../hooks/useRoleAnnouncements';
import useViewMode from '../../hooks/useViewMode';
import useAnnouncementDeletion from '../../hooks/useAnnouncementDeletion';
import AnnouncementPost from '../../components/AnnouncementPost';
import Alert from '../../components/Alert';
import NewAnnouncementRibbon from '../../components/NewAnnouncementRibbon';
import ViewToggle from '../../components/ViewToggle';
import { FileIcon, MegaphoneIcon, SearchIcon, TrashIcon } from '../../components/Icons';
import { ANNOUNCEMENT_CATEGORIES, ROLE_LABELS } from '../../data/constants';

const getFeedError = (error) => {
  switch (error?.code) {
    case 'permission-denied':
      return 'You do not have permission to view these announcements. Please contact the church leadership.';
    case 'unavailable':
      return 'Connection to the database was lost. Announcements will reload automatically when you are back online.';
    default:
      return 'Announcements could not be loaded. Please refresh the page and try again.';
  }
};

const matches = (item, term) =>
  !term ||
  [item.title, item.content, item.category, item.issuedBy, item.authorName]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(term));

export default function MemberAnnouncements() {
  const { feedRole, isLeader } = useAuth();
  const { announcements, recentCount, status, error, now } = useRoleAnnouncements();
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [view, setView] = useViewMode('member-feed', 'list');
  const { requestDelete, dialog, notice } = useAnnouncementDeletion();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return announcements.filter(
      (item) => (category === 'All' || (item.category || 'General') === category) && matches(item, term)
    );
  }, [announcements, category, search]);

  const audienceLabel = isLeader ? 'all audiences' : `${ROLE_LABELS[feedRole] || 'member'}s`;

  // Leaders manage posts straight from the feed.
  const leaderActions = (item) =>
    isLeader && (
      <>
        <Link to={`/leader/publish/${item.id}`} className="btn btn-outline btn-sm">
          <FileIcon width={15} height={15} />
          <span>Edit</span>
        </Link>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => requestDelete(item)}>
          <TrashIcon width={15} height={15} />
          <span>Delete</span>
        </button>
      </>
    );

  return (
    <div className="view">
      {status === 'ready' && recentCount > 0 && <NewAnnouncementRibbon count={recentCount} />}

      <div className="view-head">
        <div>
          <h2>Internal Announcements</h2>
          <p>Live updates published by the leadership for {audienceLabel}.</p>
        </div>
        <div className="live-pill" aria-live="polite">
          <span className="live-dot" />
          Live
        </div>
      </div>

      <div className="list-toolbar">
        <label className="toolbar-search">
          <SearchIcon width={17} height={17} />
          <span className="sr-only">Search announcements</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, content or issuing office..."
          />
        </label>
        <ViewToggle value={view} onChange={setView} label="Announcement layout" />
      </div>

      <div className="chip-row" role="group" aria-label="Filter by category">
        {['All', ...ANNOUNCEMENT_CATEGORIES].map((item) => (
          <button
            key={item}
            type="button"
            className={`chip ${category === item ? 'is-active' : ''}`}
            onClick={() => setCategory(item)}
            aria-pressed={category === item}
          >
            {item}
          </button>
        ))}
      </div>

      {notice.text && <Alert type={notice.type}>{notice.text}</Alert>}

      {status === 'loading' && (
        <div className="panel panel-loading">
          <span className="spinner" />
          <span>Connecting to the live feed...</span>
        </div>
      )}

      {status === 'error' && <Alert type="error">{getFeedError(error)}</Alert>}

      {status === 'ready' && filtered.length === 0 && (
        <div className="panel empty-state">
          <MegaphoneIcon width={28} height={28} />
          <p>
            {search.trim()
              ? `No announcements match "${search.trim()}".`
              : category === 'All'
                ? 'No announcements have been published for your group yet.'
                : `No announcements in "${category}" yet.`}
          </p>
        </div>
      )}

      {status === 'ready' && filtered.length > 0 && (
        <div className={`feed-layout is-${view}`}>
          {filtered.map((item) => (
            <AnnouncementPost
              key={item.id}
              announcement={item}
              layout={view === 'list' ? 'row' : 'card'}
              showAudience={isLeader}
              showSchedule={isLeader}
              now={now}
              actions={leaderActions(item)}
            />
          ))}
        </div>
      )}

      {dialog}
    </div>
  );
}
