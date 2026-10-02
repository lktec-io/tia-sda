import { useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import useWorshipSchedules from '../../hooks/useWorshipSchedules';
import Alert from '../../components/Alert';
import ConfirmDialog from '../../components/ConfirmDialog';
import { BookIcon, CalendarIcon, CheckIcon, ClockIcon, FileIcon, SearchIcon, TrashIcon } from '../../components/Icons';
import {
  DUTY_MAX,
  ROSTER_SECTIONS,
  WORSHIP_COLLECTION,
  cleanRoster,
  emptyRoster,
  formatRosterDate,
  isSaturday,
  parseSabatoDate,
  rosterFrom,
  rosterProgress,
  splitRosters,
  upcomingSabbathId
} from '../../lib/worship';
import '../../styles/leader.css';
import '../../styles/worship.css';

const getSaveError = (error) => {
  switch (error?.code) {
    case 'permission-denied':
      return 'Permission denied. Only leaders can manage the roster (check that the latest firestore.rules are deployed).';
    case 'unavailable':
      return 'Connection lost while saving. Please check your internet and try again.';
    default:
      return 'The roster could not be saved. Please try again.';
  }
};

/**
 * /dashboard/schedule-worship — "Manage Roster / Panga Wahudumu" (leaders only).
 * Create, edit and delete one duty roster per Sabbath in `worshipSchedules`.
 */
export default function WorshipScheduler() {
  const { currentUser, userProfile } = useAuth();
  const { rosters, status, now, retry } = useWorshipSchedules();

  const [editingId, setEditingId] = useState(null); // null = creating a new week
  const [form, setForm] = useState(() => emptyRoster());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [view, setView] = useState('upcoming'); // upcoming | history
  const [search, setSearch] = useState('');

  const { current, upcoming, past } = splitRosters(rosters, now ?? 0);
  const upcomingList = current ? [current, ...upcoming] : upcoming;
  // Live search across the week's date and every assigned name / reading.
  const term = search.trim().toLowerCase();
  const matchesSearch = (roster) =>
    !term ||
    [roster.sabatoDate, formatRosterDate(roster.sabatoDate, { long: true }), ...ROSTER_SECTIONS.flatMap((section) =>
      section.fields.map((f) => roster[section.key]?.[f.key])
    )]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  const listed = (view === 'upcoming' ? upcomingList : past).filter(matchesSearch);
  const nextSabbath = now ? upcomingSabbathId(now) : '';
  const isEdit = Boolean(editingId);
  const dateIsSaturday = isSaturday(form.sabatoDate);

  const setDuty = (sectionKey, fieldKey, value) =>
    setForm((prev) => ({ ...prev, [sectionKey]: { ...prev[sectionKey], [fieldKey]: value } }));

  const startCreate = (sabatoDate = '') => {
    setEditingId(null);
    setForm(emptyRoster(sabatoDate));
    setMessage({ type: '', text: '' });
  };

  const startEdit = (roster) => {
    setEditingId(roster.id);
    setForm(rosterFrom(roster));
    setMessage({ type: 'info', text: `Editing the roster for Sabato ${formatRosterDate(roster.sabatoDate)}.` });
    document.getElementById('roster-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const sabatoDate = form.sabatoDate;
    if (!parseSabatoDate(sabatoDate)) {
      setMessage({ type: 'error', text: 'Select the Sabbath date for this roster.' });
      return;
    }
    if (!isSaturday(sabatoDate)) {
      setMessage({ type: 'error', text: 'The selected date is not a Saturday. Please choose the Sabbath (Jumamosi) of the week.' });
      return;
    }
    const clash = rosters.find((r) => r.id === sabatoDate && r.id !== editingId);
    if (clash) {
      setMessage({
        type: 'error',
        text: `A roster for Sabato ${formatRosterDate(sabatoDate)} already exists. Edit that week instead.`
      });
      return;
    }

    const duties = cleanRoster(form);
    const ref = doc(db, WORSHIP_COLLECTION, sabatoDate);
    const created = {
      sabatoDate,
      ...duties,
      createdBy: currentUser.uid,
      createdByName: userProfile?.fullName || 'TUCASA Leadership',
      createdAt: serverTimestamp()
    };

    setSaving(true);
    setMessage({ type: 'info', text: isEdit ? 'Saving changes...' : 'Publishing roster...' });

    try {
      if (!isEdit) {
        await setDoc(ref, created);
      } else if (editingId === sabatoDate) {
        await updateDoc(ref, { ...duties, updatedBy: currentUser.uid, updatedAt: serverTimestamp() });
      } else {
        // Week moved to another Sabbath: the document id is the date, so move it atomically.
        const batch = writeBatch(db);
        batch.delete(doc(db, WORSHIP_COLLECTION, editingId));
        batch.set(ref, created);
        await batch.commit();
      }
      setEditingId(null);
      setForm(emptyRoster());
      setMessage({
        type: 'success',
        text: `Roster for Sabato ${formatRosterDate(sabatoDate)} ${isEdit ? 'updated' : 'published'}. Members can see it now.`
      });
    } catch (error) {
      console.error('Roster save error:', error);
      setMessage({ type: 'error', text: getSaveError(error) });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, WORSHIP_COLLECTION, toDelete.id));
      if (editingId === toDelete.id) startCreate();
      setMessage({ type: 'success', text: `Roster for Sabato ${formatRosterDate(toDelete.sabatoDate)} deleted.` });
    } catch (error) {
      console.error('Roster delete error:', error);
      setMessage({ type: 'error', text: getSaveError(error) });
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>
            Manage Roster <span className="view-head-sw" lang="sw">/ Panga Wahudumu</span>
          </h2>
          <p>Assign mid-week and Sabbath duties. Published rosters appear instantly in every member&apos;s Worship Roster.</p>
        </div>
        <Link to="/dashboard/roster" className="btn btn-outline btn-sm">
          <BookIcon width={16} height={16} />
          Member View
        </Link>
      </div>

      <div className="scheduler-grid">
        {/* ---------------- Form ---------------- */}
        <section className="panel" id="roster-form">
          <div className="panel-head">
            <h3>
              {isEdit ? <FileIcon width={18} height={18} /> : <CalendarIcon width={18} height={18} />}
              {isEdit ? 'Edit Week Roster' : 'New Week Roster'}
            </h3>
            {isEdit && <span className="badge badge-gold">Edit Mode</span>}
          </div>

          {message.text && <Alert type={message.type}>{message.text}</Alert>}

          <form className="roster-form" onSubmit={handleSubmit}>
            <div className="roster-week">
              <label htmlFor="roster-date">
                Select Week <span lang="sw">/ Chagua Sabato</span>
              </label>
              <div className="roster-week-row">
                <input
                  id="roster-date"
                  type="date"
                  value={form.sabatoDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, sabatoDate: e.target.value }))}
                  aria-describedby="roster-date-hint"
                  required
                />
                {nextSabbath && form.sabatoDate !== nextSabbath && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setForm((prev) => ({ ...prev, sabatoDate: nextSabbath }))}
                  >
                    This Sabbath
                  </button>
                )}
              </div>
              <p id="roster-date-hint" className={`roster-week-hint ${form.sabatoDate && !dateIsSaturday ? 'is-error' : ''}`}>
                {!form.sabatoDate
                  ? 'Choose the Saturday (Sabato) the roster is for. Mid-week dates are worked out automatically.'
                  : dateIsSaturday
                    ? `Sabato · ${formatRosterDate(form.sabatoDate, { long: true })}`
                    : `${formatRosterDate(form.sabatoDate, { long: true })} is not a Saturday.`}
              </p>
            </div>

            {ROSTER_SECTIONS.map((section) => (
              <fieldset key={section.key} className={`roster-fieldset roster-${section.key}`}>
                <legend>
                  {section.title} <span lang="sw">· {section.sw}</span>
                  {section.time && (
                    <small className="roster-time">
                      <ClockIcon width={12} height={12} />
                      <span lang="sw">{section.time}</span>
                    </small>
                  )}
                </legend>
                <div className="roster-fields">
                  {section.fields.map((field) => {
                    const id = `duty-${section.key}-${field.key}`;
                    return (
                      <div key={field.key} className="roster-field">
                        <label htmlFor={id}>
                          <strong lang="sw">{field.label}</strong>
                          <small>
                            {field.en}
                            {field.time && (
                              <>
                                {' · '}
                                <span lang="sw">{field.time}</span>
                              </>
                            )}
                          </small>
                        </label>
                        <input
                          id={id}
                          type="text"
                          value={form[section.key][field.key]}
                          onChange={(e) => setDuty(section.key, field.key, e.target.value)}
                          maxLength={DUTY_MAX}
                          placeholder={field.key.includes('Verse') || field.key.includes('Scripture') ? 'e.g. Zaburi 23:1-6' : 'Name of the person serving'}
                        />
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            <div className="roster-submit">
              {isEdit && (
                <button type="button" className="btn btn-outline" onClick={() => startCreate()} disabled={saving}>
                  Cancel
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={saving || status !== 'ready'}>
                {saving ? <span className="spinner spinner-light" /> : <CheckIcon width={17} height={17} />}
                {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Publish Roster'}
              </button>
            </div>
          </form>
        </section>

        {/* ---------------- Week list ---------------- */}
        <section className="panel">
          <div className="panel-head">
            <h3>
              <BookIcon width={18} height={18} />
              Scheduled Weeks
            </h3>
          </div>

          <div className="chip-row" role="group" aria-label="Filter weeks">
            <button
              type="button"
              className={`chip ${view === 'upcoming' ? 'is-active' : ''}`}
              aria-pressed={view === 'upcoming'}
              onClick={() => setView('upcoming')}
            >
              Upcoming ({upcomingList.length})
            </button>
            <button
              type="button"
              className={`chip ${view === 'history' ? 'is-active' : ''}`}
              aria-pressed={view === 'history'}
              onClick={() => setView('history')}
            >
              History ({past.length})
            </button>
          </div>

          <div className="list-toolbar roster-search">
            <label className="toolbar-search">
              <SearchIcon width={17} height={17} />
              <span className="sr-only">Search rosters</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, scripture or date..."
              />
            </label>
          </div>

          {status === 'loading' && (
            <div className="panel-loading">
              <span className="spinner" />
              <span>Loading rosters...</span>
            </div>
          )}

          {status === 'error' && (
            <Alert type="error">
              Rosters could not be loaded.{' '}
              <button type="button" className="btn-link" onClick={retry}>Retry</button>
            </Alert>
          )}

          {status === 'ready' && listed.length === 0 && (
            <div className="empty-state">
              <CalendarIcon width={26} height={26} />
              <p>
                {term
                  ? `No rosters match "${search.trim()}".`
                  : view === 'upcoming'
                    ? 'No upcoming weeks scheduled yet.'
                    : 'No past rosters yet.'}
              </p>
            </div>
          )}

          {status === 'ready' && listed.length > 0 && (
            <ul className="roster-cards">
              {listed.map((roster) => {
                const { filled, total } = rosterProgress(roster);
                const complete = filled === total;
                return (
                  <li key={roster.id} className={`roster-card ${editingId === roster.id ? 'is-editing' : ''}`}>
                    <div className="roster-card-top">
                      <span className="roster-card-date">
                        <CalendarIcon width={15} height={15} />
                        Sabato · {formatRosterDate(roster.sabatoDate)}
                      </span>
                      <span className={`badge ${complete ? 'badge-success' : 'badge-warning'}`}>
                        {filled}/{total} assigned
                      </span>
                    </div>
                    <dl className="roster-card-summary">
                      <div>
                        <dt lang="sw">Mhubiri Mkuu</dt>
                        <dd>{roster.divineService?.preacher || '—'}</dd>
                      </div>
                      <div>
                        <dt lang="sw">Mwenyekiti (Ibada Kuu)</dt>
                        <dd>{roster.divineService?.chair || '—'}</dd>
                      </div>
                      <div>
                        <dt lang="sw">Mwenyekiti (Shule ya Sabato)</dt>
                        <dd>{roster.sabbathSchool?.chair || '—'}</dd>
                      </div>
                    </dl>
                    <div className="roster-card-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(roster)} disabled={saving}>
                        <FileIcon width={15} height={15} />
                        Edit Schedule
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setToDelete(roster)} disabled={saving}>
                        <TrashIcon width={15} height={15} />
                        Delete Week Roster
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        busy={deleting}
        title="Delete week roster?"
        message="This removes the roster for every member. This cannot be undone."
        detail={
          toDelete && (
            <>
              <strong>Sabato · {formatRosterDate(toDelete.sabatoDate, { long: true })}</strong>
              <small>Mhubiri Mkuu: {toDelete.divineService?.preacher || 'not assigned'}</small>
            </>
          )
        }
        confirmLabel={deleting ? 'Deleting...' : 'Delete Week Roster'}
        cancelLabel="No, keep this roster"
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setToDelete(null)}
      />
    </div>
  );
}
