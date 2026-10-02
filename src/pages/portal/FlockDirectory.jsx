import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import useDirectory from '../../hooks/useDirectory';
import useRegistry from '../../hooks/useRegistry';
import useViewMode from '../../hooks/useViewMode';
import ViewToggle from '../../components/ViewToggle';
import Alert from '../../components/Alert';
import MemberAvatar from '../../components/MemberAvatar';
import { BookIcon, HeartIcon, HomeIcon, LockIcon, PhoneIcon, SearchIcon, UsersIcon, WalletIcon } from '../../components/Icons';
import { COURSES, MINISTRY_WINGS, feeStatusInfo, formatAcademicLevel, ministryLabel } from '../../data/constants';
import { byName, directoryEntryFrom, directoryLetter } from '../../lib/directory';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');

const getDirectoryError = (error) =>
  error?.code === 'permission-denied'
    ? 'You do not have permission to view the directory (check that the latest firestore.rules are deployed).'
    : 'The directory could not be loaded. Please check your connection and try again.';

/**
 * /dashboard/directory — "Flock Directory / Orodha ya Washiriki".
 * Members read the `directory` collection, which only holds photo, name, course and
 * ministry wing: phone numbers, housing and fee status never reach their browser.
 * Leaders read the full registry instead and additionally see those private fields.
 */
export default function FlockDirectory() {
  const { isLeader } = useAuth();
  return isLeader ? <LeaderDirectory /> : <MemberDirectory />;
}

function MemberDirectory() {
  const { entries, status, error, retry } = useDirectory();
  return <DirectoryGallery entries={entries} status={status} error={error} retry={retry} showPrivate={false} />;
}

function LeaderDirectory() {
  const { members, status, error, retry } = useRegistry();
  const entries = useMemo(
    () =>
      members
        .map((m) => ({
          ...directoryEntryFrom({ ...m, uid: m.id }),
          id: m.id,
          private: { phone: m.phone || '', area: m.area || '', houseNumber: m.houseNumber || '', feeStatus: m.feeStatus }
        }))
        .sort(byName),
    [members]
  );
  return <DirectoryGallery entries={entries} status={status} error={error} retry={retry} showPrivate />;
}

function DirectoryGallery({ entries, status, error, retry, showPrivate }) {
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('All');
  const [ministry, setMinistry] = useState('All');
  const [letter, setLetter] = useState('All');
  const [view, setView] = useViewMode('directory', 'grid');

  // Only courses that someone in the flock is actually enrolled in.
  const courseOptions = useMemo(() => {
    const codes = new Set(entries.map((e) => e.courseCode).filter(Boolean));
    return COURSES.filter((c) => codes.has(c.code));
  }, [entries]);

  const filteredByFields = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (course === 'All' || e.courseCode === course) &&
        (ministry === 'All' || (e.ministryWing || 'None') === ministry) &&
        (!term ||
          (e.fullName || '').toLowerCase().includes(term) ||
          (e.courseName || '').toLowerCase().includes(term) ||
          (e.courseCode || '').toLowerCase().includes(term))
    );
  }, [entries, search, course, ministry]);

  const lettersPresent = useMemo(() => new Set(filteredByFields.map((e) => directoryLetter(e.fullName))), [filteredByFields]);

  // Letter grouping for the alphabetical gallery.
  const groups = useMemo(() => {
    const visible = letter === 'All' ? filteredByFields : filteredByFields.filter((e) => directoryLetter(e.fullName) === letter);
    const map = new Map();
    visible.forEach((e) => {
      const key = directoryLetter(e.fullName);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return [...map.entries()].sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)));
  }, [filteredByFields, letter]);

  const shown = groups.reduce((sum, [, list]) => sum + list.length, 0);
  const filtersActive = search || course !== 'All' || ministry !== 'All' || letter !== 'All';

  const resetFilters = () => {
    setSearch('');
    setCourse('All');
    setMinistry('All');
    setLetter('All');
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>
            Flock Directory <span className="view-head-sw" lang="sw">/ Orodha ya Washiriki</span>
          </h2>
          <p>Get to know the TUCASA TIA Mbeya family — alphabetical, by course and ministry wing.</p>
        </div>
        <span className={`badge ${showPrivate ? 'badge-gold' : ''}`}>
          {showPrivate ? 'Leader view · private details' : 'Privacy protected'}
        </span>
      </div>

      {!showPrivate && (
        <p className="directory-privacy">
          <LockIcon width={15} height={15} />
          Phone numbers, housing and fee status are private and visible only to the leadership.
        </p>
      )}

      <section className="panel directory-filters" aria-label="Directory filters">
        <div className="directory-filter-row">
          <label className="directory-search">
            <SearchIcon width={17} height={17} />
            <span className="sr-only">Search the directory</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by full name or course..."
            />
          </label>

          <label className="directory-select">
            <span>Course</span>
            <select value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="All">All courses</option>
              {courseOptions.map((c) => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </select>
          </label>

          <label className="directory-select">
            <span>Ministry Wing</span>
            <select value={ministry} onChange={(e) => setMinistry(e.target.value)}>
              <option value="All">All ministry wings</option>
              {MINISTRY_WINGS.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="letter-index" role="group" aria-label="Jump to letter">
          <button
            type="button"
            className={`letter-chip ${letter === 'All' ? 'is-active' : ''}`}
            aria-pressed={letter === 'All'}
            onClick={() => setLetter('All')}
          >
            All
          </button>
          {LETTERS.map((l) => (
            <button
              key={l}
              type="button"
              className={`letter-chip ${letter === l ? 'is-active' : ''}`}
              aria-pressed={letter === l}
              disabled={!lettersPresent.has(l)}
              onClick={() => setLetter(l)}
            >
              {l}
            </button>
          ))}
        </div>
      </section>

      {status === 'loading' && (
        <div className="panel panel-loading">
          <span className="spinner" />
          <span>Loading the flock...</span>
        </div>
      )}

      {status === 'error' && (
        <Alert type="error">
          {getDirectoryError(error)}{' '}
          <button type="button" className="btn-link" onClick={retry}>Retry</button>
        </Alert>
      )}

      {status === 'ready' && (
        <>
          <div className="directory-bar">
            <p className="directory-count" aria-live="polite">
              Showing {shown} of {entries.length} {entries.length === 1 ? 'person' : 'people'}
              {filtersActive && (
                <>
                  {' · '}
                  <button type="button" className="btn-link" onClick={resetFilters}>Clear filters</button>
                </>
              )}
            </p>
            <ViewToggle value={view} onChange={setView} label="Directory layout" />
          </div>

          {shown === 0 ? (
            <div className="panel empty-state">
              <UsersIcon width={28} height={28} />
              <p>
                {entries.length === 0
                  ? 'The directory is empty for now. Members appear here after they next sign in to the portal.'
                  : 'Nobody matches these filters.'}
              </p>
            </div>
          ) : (
            groups.map(([groupLetter, list]) => (
              <section key={groupLetter} className="directory-group" aria-labelledby={`dir-letter-${groupLetter}`}>
                <h3 id={`dir-letter-${groupLetter}`} className="directory-letter">{groupLetter}</h3>
                <ul className={`directory-grid is-${view}`}>
                  {list.map((entry) => (
                    <DirectoryCard key={entry.id || entry.uid} entry={entry} showPrivate={showPrivate} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}

function DirectoryCard({ entry, showPrivate }) {
  const level = entry.academicLevel ? formatAcademicLevel(entry.academicLevel) : '';
  const wing = entry.ministryWing && entry.ministryWing !== 'None' ? ministryLabel(entry.ministryWing) : '';
  const priv = showPrivate ? entry.private : null;
  const fee = priv ? feeStatusInfo(priv.feeStatus) : null;

  return (
    <li className="directory-card">
      <MemberAvatar name={entry.fullName} photoUrl={entry.profilePictureUrl} size="lg" />
      <div className="directory-card-main">
        <h4>{entry.fullName || 'Unnamed member'}</h4>

        <p className="directory-course">
          <BookIcon width={14} height={14} />
          <span>
            {entry.courseCode ? <strong>{entry.courseCode}</strong> : null}
            {entry.courseName ? ` ${entry.courseName}` : entry.courseCode ? '' : 'Course not set'}
          </span>
        </p>

        <div className="directory-tags">
          {level && <span className="badge">{level}</span>}
          {wing && (
            <span className="badge badge-gold">
              <HeartIcon width={12} height={12} /> {wing}
            </span>
          )}
        </div>
      </div>

      {/* Leader-only block: these values are never fetched for non-leaders. */}
      {priv && (
        <dl className="directory-private">
          <div>
            <dt><PhoneIcon width={13} height={13} /> Phone</dt>
            <dd>{priv.phone ? <a href={`tel:${priv.phone}`}>{priv.phone}</a> : '—'}</dd>
          </div>
          <div>
            <dt><HomeIcon width={13} height={13} /> House</dt>
            <dd>{[priv.area, priv.houseNumber].filter(Boolean).join(' · ') || '—'}</dd>
          </div>
          <div>
            <dt><WalletIcon width={13} height={13} /> Fee</dt>
            <dd>
              <span className={`badge ${priv.feeStatus === 'fully_paid' ? 'badge-success' : priv.feeStatus === 'unpaid' ? 'badge-warning' : ''}`}>
                {fee.label}
              </span>
            </dd>
          </div>
        </dl>
      )}
    </li>
  );
}
