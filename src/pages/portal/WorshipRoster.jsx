import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useWorshipSchedules from '../../hooks/useWorshipSchedules';
import RosterSheet from '../../components/RosterSheet';
import Alert from '../../components/Alert';
import { BookIcon, CalendarIcon, ChevronDownIcon } from '../../components/Icons';
import { formatRosterDate, rosterProgress, splitRosters } from '../../lib/worship';
import '../../styles/worship.css';

const getRosterError = (error) =>
  error?.code === 'permission-denied'
    ? 'You do not have permission to view the worship roster (check that the latest firestore.rules are deployed).'
    : 'The worship roster could not be loaded. Please check your connection and try again.';

/**
 * /dashboard/roster — read-only "Worship Roster / Ratiba ya Wahudumu".
 * This week's (or the next scheduled) Sabbath is framed at the top; later weeks and
 * the archive of past rosters open as accordions below.
 */
export default function WorshipRoster() {
  const { isLeader } = useAuth();
  const { rosters, status, error, now, retry } = useWorshipSchedules();
  const { current, upcoming, past, thisSabbath } = splitRosters(rosters, now ?? 0);
  const isThisWeek = current?.sabatoDate === thisSabbath;

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>
            Worship Roster <span className="view-head-sw" lang="sw">/ Ratiba ya Wahudumu</span>
          </h2>
          <p>Who is serving at each mid-week and Sabbath service.</p>
        </div>
        {isLeader && (
          <Link to="/dashboard/schedule-worship" className="btn btn-outline btn-sm">
            <CalendarIcon width={16} height={16} />
            Manage Roster
          </Link>
        )}
      </div>

      {status === 'loading' && (
        <div className="panel panel-loading">
          <span className="spinner" />
          <span>Loading the worship roster...</span>
        </div>
      )}

      {status === 'error' && (
        <Alert type="error">
          {getRosterError(error)}{' '}
          <button type="button" className="btn-link" onClick={retry}>Retry</button>
        </Alert>
      )}

      {status === 'ready' && (
        <>
          {current ? (
            <article className="roster-feature" aria-labelledby="roster-current-title">
              <header className="roster-feature-head">
                <span className="roster-feature-eyebrow">
                  {isThisWeek ? "This Week's Roster" : 'Next Scheduled Roster'}
                  <span lang="sw"> · {isThisWeek ? 'Ratiba ya Wiki Hii' : 'Ratiba Inayofuata'}</span>
                </span>
                <h3 id="roster-current-title">Sabato · {formatRosterDate(current.sabatoDate, { long: true })}</h3>
              </header>
              <RosterSheet roster={current} />
            </article>
          ) : (
            <div className="panel empty-state">
              <BookIcon width={28} height={28} />
              <p>No roster has been published for this week yet. Please check back soon.</p>
            </div>
          )}

          {upcoming.length > 0 && (
            <RosterAccordion title="Upcoming Rosters" sw="Ratiba Zijazo" rosters={upcoming} />
          )}

          <RosterAccordion
            title="Past Worship Rosters"
            sw="Ratiba za Ibada Zilizopita"
            rosters={past}
            empty="Past rosters will appear here after each Sabbath."
          />
        </>
      )}
    </div>
  );
}

function RosterAccordion({ title, sw, rosters, empty }) {
  const [openId, setOpenId] = useState(null);

  return (
    <section className="panel roster-archive">
      <div className="panel-head">
        <h3>
          {title} <span className="roster-archive-sw" lang="sw">/ {sw}</span>
        </h3>
        <span className="badge">{rosters.length}</span>
      </div>

      {rosters.length === 0 ? (
        <p className="roster-archive-empty">{empty}</p>
      ) : (
        <ul className="roster-accordion">
          {rosters.map((roster) => {
            const open = openId === roster.id;
            const { filled, total } = rosterProgress(roster);
            const panelId = `roster-panel-${roster.id}`;
            return (
              <li key={roster.id} className={`roster-acc-item ${open ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="roster-acc-toggle"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenId(open ? null : roster.id)}
                >
                  <CalendarIcon width={17} height={17} />
                  <span className="roster-acc-title">
                    <strong>Sabato · {formatRosterDate(roster.sabatoDate)}</strong>
                    <small>
                      Mhubiri: {roster.divineService?.preacher?.trim() || 'To be assigned'} · {filled}/{total} duties
                    </small>
                  </span>
                  <ChevronDownIcon width={18} height={18} className="roster-acc-chevron" />
                </button>
                <div id={panelId} className="roster-acc-panel" role="region" hidden={!open}>
                  <RosterSheet roster={roster} compact />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
