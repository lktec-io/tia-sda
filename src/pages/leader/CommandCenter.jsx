import { useCallback, useMemo, useState } from 'react';
import { deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import Alert from '../../components/Alert';
import ConfirmDialog from '../../components/ConfirmDialog';
import MemberAvatar from '../../components/MemberAvatar';
import MemberDrawer from '../../components/MemberDrawer';
import FeeSegment from '../../components/FeeSegment';
import PublishedAnnouncements from './PublishedAnnouncements';
import {
  DownloadIcon,
  FileIcon,
  MusicIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
  WalletIcon
} from '../../components/Icons';
import {
  ACADEMIC_LEVELS,
  RESIDENTIAL_AREAS,
  YEAR_OPTIONS,
  FEE_ANNUAL_TZS,
  FEE_PER_SEMESTER_TZS,
  FEE_STATUSES,
  coursesForLevel,
  feeStatusInfo,
  formatAcademicLevel,
  formatRole,
  formatTZS,
  formatYear
} from '../../data/constants';
import useRegistry from '../../hooks/useRegistry';
import { computeLedger, exportRegistryCsv, getRegistryError } from '../../lib/registry';
import { formatDate, toMillis } from '../../utils/format';
import '../../styles/leader.css';

const getDbError = getRegistryError;

function MetricCard({ icon, label, value, hint, tone }) {
  return (
    <article className={`metric metric-${tone}`}>
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-hint">{hint}</span>
    </article>
  );
}

/**
 * "Church Treasury Insights / Hali ya Hazina ya Kanisa" — live ledger figures:
 * revenue = 2,500 TZS × semester-1 payers + 5,000 TZS × fully paid members.
 */
function TreasuryInsights({ ledger, ready }) {
  const collectionRate = ledger.potential > 0 ? Math.round((ledger.revenue / ledger.potential) * 100) : 0;
  const show = (text) => (ready ? text : '—');

  return (
    <section className="treasury" aria-labelledby="treasury-title">
      <div className="treasury-head">
        <div>
          <h3 id="treasury-title">Church Treasury Insights</h3>
          <span lang="sw">Hali ya Hazina ya Kanisa</span>
        </div>
        <span className="treasury-rate-chip">
          {FEE_PER_SEMESTER_TZS.toLocaleString('en-US')} TZS / semester · {FEE_ANNUAL_TZS.toLocaleString('en-US')} TZS / year
        </span>
      </div>

      <div className="treasury-grid">
        <article className="treasury-card treasury-card-revenue">
          <span className="treasury-label">Total Collected Revenue</span>
          <strong className="treasury-value">{show(formatTZS(ledger.revenue))}</strong>
          <div
            className="treasury-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={ready ? collectionRate : 0}
            aria-label="Share of potential annual fees collected"
          >
            <span style={{ width: `${ready ? collectionRate : 0}%` }} />
          </div>
          <span className="treasury-hint">
            {show(`${collectionRate}% of ${formatTZS(ledger.potential)} potential (${ledger.total} members)`)}
          </span>
        </article>

        <article className="treasury-card">
          <span className="treasury-label">Fully Paid</span>
          <strong className="treasury-count treasury-count-emerald">{show(ledger.fullyPaid)}</strong>
          <span className="treasury-hint">{show(formatTZS(ledger.fullyPaid * FEE_ANNUAL_TZS))}</span>
        </article>

        <article className="treasury-card">
          <span className="treasury-label">Semester 1 Paid</span>
          <strong className="treasury-count treasury-count-sapphire">{show(ledger.semesterPaid)}</strong>
          <span className="treasury-hint">{show(formatTZS(ledger.semesterPaid * FEE_PER_SEMESTER_TZS))}</span>
        </article>

        <article className="treasury-card">
          <span className="treasury-label">Unpaid</span>
          <strong className="treasury-count treasury-count-amber">{show(ledger.unpaid)}</strong>
          <span className="treasury-hint">{show(`${formatTZS(ledger.outstanding)} outstanding`)}</span>
        </article>
      </div>
    </section>
  );
}

export default function CommandCenter() {
  const { currentUser } = useAuth();
  // Live, enriched registry shared with the Executive Overview (see hooks/useRegistry).
  const { members: registry, status, error: loadError, retry: retryRegistry } = useRegistry();
  const users = registry;

  const [search, setSearch] = useState('');
  const [feeFilter, setFeeFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');

  const [feeBusy, setFeeBusy] = useState(() => new Set());
  const [memberToDelete, setMemberToDelete] = useState(null); // member object
  const [deleting, setDeleting] = useState(false);
  const [drawerId, setDrawerId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Live treasury ledger from the whole registry.
  const ledger = useMemo(() => computeLedger(registry), [registry]);

  // Course filter follows the selected level; "All levels" shows every course grouped by level.
  const courseGroups = useMemo(
    () =>
      (levelFilter === 'all' ? ACADEMIC_LEVELS : ACADEMIC_LEVELS.filter((l) => l.value === levelFilter)).map((level) => ({
        level,
        courses: coursesForLevel(level.value)
      })),
    [levelFilter]
  );

  const changeLevelFilter = (value) => {
    setLevelFilter(value);
    // Drop a course selection that doesn't belong to the newly chosen level.
    if (value !== 'all' && courseFilter !== 'all' && !coursesForLevel(value).some((c) => c.code === courseFilter)) {
      setCourseFilter('all');
    }
  };

  const metrics = useMemo(
    () => ({
      total: registry.length,
      feesPaid: registry.filter((u) => u.feeStatus === 'fully_paid').length,
      feesOutstanding: registry.filter((u) => u.feeStatus !== 'fully_paid').length,
      choir: registry.filter((u) => u.ministryWing === 'Choir').length
    }),
    [registry]
  );

  // Official Mbeya Mjini areas first, then any other areas found in the data.
  const areaOptions = useMemo(() => {
    const extras = [...new Set(registry.map((u) => u.area).filter((a) => a && !RESIDENTIAL_AREAS.includes(a)))];
    return [...RESIDENTIAL_AREAS, ...extras.sort((a, b) => a.localeCompare(b))];
  }, [registry]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return registry
      .filter((u) => feeFilter === 'all' || u.feeStatus === feeFilter)
      .filter((u) => levelFilter === 'all' || u.academicLevel === levelFilter)
      .filter((u) => courseFilter === 'all' || u.courseCode === courseFilter)
      .filter((u) => yearFilter === 'all' || u.academicDetails?.yearOfStudy === yearFilter)
      .filter((u) => areaFilter === 'all' || u.area === areaFilter)
      .filter((u) => {
        if (!term) return true;
        return [
          u.fullName,
          u.email,
          u.phone,
          u.courseCode,
          u.courseName,
          u.area,
          u.houseNumber
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  }, [registry, search, feeFilter, levelFilter, courseFilter, yearFilter, areaFilter]);

  const drawerMember = drawerId ? registry.find((u) => u.id === drawerId) || null : null;
  const filtersActive =
    search ||
    feeFilter !== 'all' ||
    levelFilter !== 'all' ||
    courseFilter !== 'all' ||
    yearFilter !== 'all' ||
    areaFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setFeeFilter('all');
    setLevelFilter('all');
    setCourseFilter('all');
    setYearFilter('all');
    setAreaFilter('all');
  };

  const closeDrawer = useCallback(() => setDrawerId(null), []);
  const cancelDelete = useCallback(() => setMemberToDelete(null), []);

  // ---------- Membership fee (semester ledger) ----------
  // The registry listener re-renders the row, drawer and treasury the moment the write
  // lands (Firestore applies it locally first), so the UI updates instantly.
  const setFeeStatus = async (member, nextStatus) => {
    if (feeBusy.has(member.id) || member.feeStatus === nextStatus) return;

    setFeeBusy((prev) => new Set(prev).add(member.id));
    setMessage({ type: '', text: '' });

    try {
      await updateDoc(doc(db, 'users', member.id), {
        feeStatus: nextStatus,
        membershipFeePaid: nextStatus === 'fully_paid', // legacy flag kept in sync
        feeUpdatedBy: currentUser.uid,
        feeUpdatedAt: serverTimestamp()
      });
      const info = feeStatusInfo(nextStatus);
      setMessage({
        type: 'success',
        text: `${member.fullName || 'Member'} is now marked as ${info.label.toUpperCase()} (${formatTZS(info.amount)}).`
      });
    } catch (error) {
      console.error('Fee update error:', error);
      setMessage({ type: 'error', text: getDbError(error) });
    } finally {
      setFeeBusy((prev) => {
        const next = new Set(prev);
        next.delete(member.id);
        return next;
      });
    }
  };

  // ---------- Delete ----------
  const confirmDelete = async () => {
    if (!memberToDelete) return;
    setDeleting(true);

    try {
      await deleteDoc(doc(db, 'users', memberToDelete.id));
      if (drawerId === memberToDelete.id) setDrawerId(null);
      setMessage({ type: 'success', text: `${memberToDelete.fullName || 'The member'} has been removed from the registry.` });
      setMemberToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);
      setMessage({ type: 'error', text: getDbError(error) });
      setMemberToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  // ---------- CSV export ----------
  const exportCsv = () => {
    if (exportRegistryCsv(filteredUsers) === 0) return;
    setMessage({
      type: 'success',
      text: `Exported ${filteredUsers.length} member${filteredUsers.length === 1 ? '' : 's'} to CSV${filtersActive ? ' (current filters applied)' : ''}.`
    });
  };

  // Leaders (including yourself) can't be removed here; everyone else can.
  const canDelete = (u) => u.id !== currentUser.uid && u.role !== 'leader';

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>Leadership Command Center</h2>
          <p>Live overview of the TUCASA TIA Mbeya community, membership fees and registry.</p>
        </div>
        <div className="live-pill">
          <span className="live-dot" />
          Live
        </div>
      </div>

      {status === 'error' && (
        <Alert type="error">
          {getDbError(loadError)}{' '}
          <button type="button" className="btn-link" onClick={retryRegistry}>
            Retry
          </button>
        </Alert>
      )}

      {/* ---------- Treasury (top layer) ---------- */}
      <TreasuryInsights ledger={ledger} ready={status === 'ready'} />

      {/* ---------- Analytics ---------- */}
      <section className="metric-grid" aria-label="Community analytics">
        <MetricCard
          tone="blue"
          icon={<UsersIcon width={20} height={20} />}
          label="Total Registered Community"
          value={status === 'ready' ? metrics.total : '—'}
          hint={status === 'ready' ? `${metrics.feesPaid} fully paid for the year` : 'Loading...'}
        />
        <MetricCard
          tone="gold"
          icon={<WalletIcon width={20} height={20} />}
          label="Not Yet Fully Paid"
          value={status === 'ready' ? metrics.feesOutstanding : '—'}
          hint={metrics.feesOutstanding > 0 ? 'Unpaid or Semester 1 only' : 'Everyone is paid up'}
        />
        <MetricCard
          tone="green"
          icon={<MusicIcon width={20} height={20} />}
          label="Active Choir Members"
          value={status === 'ready' ? metrics.choir : '—'}
          hint="Registered under TUCASA Choir"
        />
      </section>

      {/* ---------- Registry ---------- */}
      <section className="panel registry">
        <div className="panel-head">
          <h3>Member Management Registry</h3>
          <span className="registry-count">
            Showing {filteredUsers.length} of {users.length}
          </span>
        </div>

        <div className="registry-filters">
          <label className="filter filter-search">
            <span className="sr-only">Search members</span>
            <SearchIcon width={17} height={17} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone, course code, area or house number"
            />
          </label>

          <label className="filter">
            <span className="filter-label">Membership Fee</span>
            <select value={feeFilter} onChange={(e) => setFeeFilter(e.target.value)}>
              <option value="all">All members</option>
              {FEE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>

          <label className="filter">
            <span className="filter-label">Academic Level</span>
            <select value={levelFilter} onChange={(e) => changeLevelFilter(e.target.value)}>
              <option value="all">All levels</option>
              {ACADEMIC_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>{level.short}</option>
              ))}
            </select>
          </label>

          <label className="filter">
            <span className="filter-label">Course</span>
            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
              <option value="all">
                {levelFilter === 'all' ? 'All courses' : `All ${formatAcademicLevel(levelFilter)} courses`}
              </option>
              {courseGroups.map(({ level, courses }) => (
                <optgroup key={level.value} label={level.label}>
                  {courses.map((course) => (
                    <option key={course.code} value={course.code}>{course.code} — {course.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="filter">
            <span className="filter-label">Year of Study</span>
            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="all">All years</option>
              {YEAR_OPTIONS.map((year) => (
                <option key={year.value} value={year.value}>{year.label}</option>
              ))}
            </select>
          </label>

          <label className="filter">
            <span className="filter-label">Residential Area</span>
            <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
              <option value="all">All areas</option>
              {areaOptions.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="registry-toolbar">
          {filtersActive ? (
            <button type="button" className="btn-link" onClick={clearFilters}>Clear filters</button>
          ) : (
            <span className="registry-toolbar-note">Newest registrations are listed first.</span>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={exportCsv}
            disabled={status !== 'ready' || filteredUsers.length === 0}
          >
            <DownloadIcon width={16} height={16} />
            Export Registry to CSV
          </button>
        </div>

        {message.text && <Alert type={message.type}>{message.text}</Alert>}

        {status === 'loading' && (
          <div className="panel-loading">
            <span className="spinner" />
            <span>Loading member registry...</span>
          </div>
        )}

        {status === 'ready' && filteredUsers.length === 0 && (
          <div className="empty-state">
            <UsersIcon width={28} height={28} />
            <p>{users.length === 0 ? 'No one has registered yet.' : 'No members match these filters.'}</p>
          </div>
        )}

        {status === 'ready' && filteredUsers.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Access</th>
                  <th scope="col">Academic</th>
                  <th scope="col">Residence</th>
                  <th scope="col">Ministry</th>
                  <th scope="col">Membership Fee</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser.uid;
                  return (
                    <tr key={u.id} className={u.feeStatus === 'fully_paid' ? '' : 'row-unpaid'}>
                      <td data-label="Member">
                        <div className="cell-member">
                          <MemberAvatar name={u.fullName || u.email || ''} photoUrl={u.profilePictureUrl} size="sm" />
                          <div>
                            <strong>{u.fullName || 'Unnamed'}{isSelf && <em className="cell-you"> (you)</em>}</strong>
                            <small>{u.email}</small>
                            <small className="cell-joined">Joined {formatDate(u.createdAt, '—')}</small>
                          </div>
                        </div>
                      </td>
                      <td data-label="Phone">
                        {u.phone ? <a href={`tel:${u.phone}`} className="cell-link">{u.phone}</a> : '—'}
                      </td>
                      <td data-label="Access">
                        <span className={`badge ${u.role === 'leader' ? 'badge-gold' : ''}`}>
                          {formatRole(u)}
                        </span>
                      </td>
                      <td data-label="Academic">
                        <span className="cell-stack">
                          <strong>
                            {u.courseCode || '—'} · {formatYear(u.academicDetails?.yearOfStudy)}
                          </strong>
                          <small>{formatAcademicLevel(u.academicLevel)}</small>
                        </span>
                      </td>
                      <td data-label="Residence">
                        <span className="cell-stack">
                          <strong>{u.area || '—'}</strong>
                          <small>{u.houseNumber}</small>
                        </span>
                      </td>
                      <td data-label="Ministry">{u.ministryWing || 'None'}</td>
                      <td data-label="Membership Fee">
                        <FeeSegment
                          size="sm"
                          value={u.feeStatus}
                          busy={feeBusy.has(u.id)}
                          disabled={isSelf}
                          label={`Membership fee status for ${u.fullName || u.email || 'member'}`}
                          onChange={(next) => setFeeStatus(u, next)}
                        />
                      </td>
                      <td data-label="Actions" className="cell-action">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => setDrawerId(u.id)}
                            aria-label={`View full member file for ${u.fullName || u.email}`}
                            title="View Full Member File"
                          >
                            <FileIcon width={17} height={17} />
                            <span className="icon-btn-text">View File</span>
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn-danger"
                            onClick={() => setMemberToDelete(u)}
                            disabled={!canDelete(u)}
                            aria-label={`Delete ${u.fullName || u.email} from the registry`}
                            title={canDelete(u) ? 'Delete member' : 'Leader accounts cannot be removed here'}
                          >
                            <TrashIcon width={17} height={17} />
                            <span className="icon-btn-text">Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PublishedAnnouncements />

      <MemberDrawer
        member={drawerMember}
        isSelf={drawerMember?.id === currentUser.uid}
        feeBusy={drawerMember ? feeBusy.has(drawerMember.id) : false}
        onFeeStatusChange={(next) => drawerMember && setFeeStatus(drawerMember, next)}
        onDelete={() => drawerMember && setMemberToDelete(drawerMember)}
        onClose={closeDrawer}
        canDelete={drawerMember ? canDelete(drawerMember) : false}
        suspendKeyboard={Boolean(memberToDelete)}
      />

      <ConfirmDialog
        open={Boolean(memberToDelete)}
        danger
        title="Remove member?"
        message="Are you sure you want to completely remove this member from the registry?"
        detail={
          memberToDelete && (
            <>
              <strong>{memberToDelete.fullName || 'Unnamed member'}</strong>
              <span>{memberToDelete.email}</span>
              <small>This deletes their profile permanently and cannot be undone.</small>
            </>
          )
        }
        confirmLabel={deleting ? 'Removing...' : 'Yes, remove member'}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
