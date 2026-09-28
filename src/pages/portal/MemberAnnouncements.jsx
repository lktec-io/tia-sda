import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import useRoleAnnouncements from '../../hooks/useRoleAnnouncements';
import AnnouncementPost from '../../components/AnnouncementPost';
import Alert from '../../components/Alert';
import { MegaphoneIcon } from '../../components/Icons';
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

export default function MemberAnnouncements() {
  const { feedRole, isLeader } = useAuth();
  const { announcements, status, error } = useRoleAnnouncements();
  const [category, setCategory] = useState('All');

  const filtered = useMemo(
    () => (category === 'All' ? announcements : announcements.filter((item) => (item.category || 'General') === category)),
    [announcements, category]
  );

  const audienceLabel = isLeader ? 'all audiences' : `${ROLE_LABELS[feedRole] || 'member'}s`;

  return (
    <div className="view">
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
            {category === 'All'
              ? 'No announcements have been published for your group yet.'
              : `No announcements in "${category}" yet.`}
          </p>
        </div>
      )}

      {status === 'ready' && filtered.length > 0 && (
        <div className="post-stack">
          {filtered.map((item) => (
            <AnnouncementPost key={item.id} announcement={item} showAudience={isLeader} />
          ))}
        </div>
      )}
    </div>
  );
}
