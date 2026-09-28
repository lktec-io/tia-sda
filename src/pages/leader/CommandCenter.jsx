import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import Alert from '../../components/Alert';
import ConfirmDialog from '../../components/ConfirmDialog';
import MemberAvatar from '../../components/MemberAvatar';
import MemberDrawer from '../../components/MemberDrawer';
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
  canonicalArea,
  coursesForLevel,
  formatAcademicLevel,
  formatRole,
  formatYear,
  getAcademicLevel,
  getCourseCode,
  getCourseName,
  getHouseNumber
} from '../../data/constants';
import { buildCsv, downloadCsv } from '../../utils/csv';
import { formatDate, toDate, toMillis } from '../../utils/format';
import '../../styles/leader.css';

const getDbError = (error) => {
  switch (error?.code) {
    case 'permission-denied':
      return 'Permission denied. Your leader account is not authorised for this action in the database rules.';
    case 'unavailable':
      return 'Connection to the database was lost. Changes will sync once you are back online.';
    case 'not-found':
      return 'That member no longer exists in the registry.';
    default:
      return 'A database error occurred. Please try again.';
  }
};

const isoDate = (value) => {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : '';
};

// Columns for "Export Registry to CSV" â€” every field collected at registration.
// Rows are pre-enriched with academicLevel / courseCode / courseName / area (see `registry`).
const CSV_COLUMNS = [
  { header: 'Full Name', value: (u) => u.fullName },
  { header: 'Email', value: (u) => u.email },
  { header: 'Phone', value: (u) => u.phone },
  { header: 'Access Level', value: (u) => formatRole(u) },
  { header: 'Membership Fee', value: (u) => (u.membershipFeePaid ? 'Paid' : 'Unpaid') },
  { header: 'Academic Level', value: (u) => (u.academicLevel ? formatAcademicLevel(u.academicLevel, { long: true }) : '') },
  { header: 'Course Code', value: (u) => u.courseCode },
  { header: 'Course Name', value: (u) => u.courseName },
  { header: 'Year of Study', value: (u) => formatYear(u.academicDetails?.yearOfStudy) },
  { header: 'Residential Area', value: (u) => u.area },
  { header: 'House Number / Hostel Block', value: (u) => u.houseNumber },
  { header: 'Ministry Wing', value: (u) => u.ministryWing || 'None' },
  { header: 'Registered On', value: (u) => isoDate(u.createdAt) },
  { header: 'Profile Picture URL', value: (u) => u.profilePictureUrl },
  { header: 'Member ID', value: (u) => u.id }
];

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

function FeeToggle({ paid, busy, disabled, onToggle, name }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={paid}
      aria-label={`Membership fee for ${name}: ${paid ? 'paid' : 'unpaid'}`}
      className={`fee-toggle ${paid ? 'is-paid' : ''}`}
      onClick={onToggle}
      disabled={busy || disabled}
      title={disabled ? 'Leaders cannot change their own fee status' : undefined}
    >
      <span className="fee-track" aria-hidden="true">
        <span className="fee-thumb">{busy && <span className="fee-spinner" />}</span>
      </span>
      <span className="fee-label">{paid ? 'Paid' : 'Unpaid'}</span>
    </button>
  );
}

export default function CommandCenter() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState(null);

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

  // Live registry â€” metrics and table update the moment anything changes.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setUsers(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data({ serverTimestamps: 'estimate' }) })));
        setStatus('ready');
        setLoadError(null);
      },
      (error) => {
        console.error('User registry error:', error);
        setLoadError(error);
        setStatus('error');
      }
    );
    return unsubscribe;
  }, []);

  // Normalised view of every profile (legacy courses/areas mapped onto official values)
  // so filters, table and CSV all agree.
  const registry = useMemo(
    () =>
      users.map((u) => ({
        ...u,
        academicLevel: getAcademicLevel(u.academicDetails),
        courseCode: getCourseCode(u.academicDetails),
        courseName: getCourseName(u.academicDetails),
        area: canonicalArea(u.location?.residentialArea || ''),
        houseNumber: getHouseNumber(u.location)
      })),
    [users]
  );

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
      feesPaid: registry.filter((u) => u.membershipFeePaid === true).length,
      feesOutstanding: registry.filter((u) => u.membershipFeePaid !== true).length,
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
      .filter((u) => feeFilter === 'all' || (feeFilter === 'paid') === (u.membershipFeePaid === true))
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

  // ---------- Membership fee ----------
  const toggleFee = async (member) => {
    if (feeBusy.has(member.id)) return;
    const nextPaid = member.membershipFeePaid !== true;

    setFeeBusy((prev) => new Set(prev).add(member.id));
    setMessage({ type: '', text: '' });

    try {
      await updateDoc(doc(db, 'users', member.id), {
        membershipFeePaid: nextPaid,
        feeUpdatedBy: currentUser.uid,
        feeUpdatedAt: serverTimestamp()
      });
      setMessage({
        type: 'success',
        text: `${member.fullName || 'Member'} is now marked as ${nextPaid ? 'PAID' : 'UNPAID'} for the membership fee.`
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
    if (filteredUsers.length === 0) return;
    const csv = buildCsv(filteredUsers, CSV_COLUMNS);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`tucasa-tia-mbeya-registry-${stamp}.csv`, csv);
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

      {status === 'error' && <Alert type="error">{getDbError(loadError)}</Alert>}

      {/* ---------- Analytics ---------- */}
      <section className="metric-grid" aria-label="Community analytics">
        <MetricCard
          tone="blue"
          icon={<UsersIcon width={20} height={20} />}
          label="Total Registered Community"
          value={status === 'ready' ? metrics.total : 'â€”'}
          hint={status === 'ready' ? `${metrics.feesPaid} membership fee${metrics.feesPaid === 1 ? '' : 's'} paid` : 'Loading...'}
        />
        <MetricCard
          tone="gold"
          icon={<WalletIcon width={20} height={20} />}
          label="Membership Fees Outstanding"
          value={status === 'ready' ? metrics.feesOutstanding : 'â€”'}
          hint={metrics.feesOutstanding > 0 ? 'Members yet to pay' : 'Everyone is paid up'}
        />
        <MetricCard
          tone="green"
          icon={<MusicIcon width={20} height={20} />}
          label="Active Choir Members"
          value={status === 'ready' ? metrics.choir : 'â€”'}
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
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
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
                    <option key={course.code} value={course.code}>{course.code} â€” {course.name}</option>
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
                    <tr key={u.id} className={u.membershipFeePaid ? '' : 'row-unpaid'}>
                      <td data-label="Member">
                        <div className="cell-member">
                          <MemberAvatar name={u.fullName || u.email || ''} photoUrl={u.profilePictureUrl} size="sm" />
                          <div>
                            <strong>{u.fullName || 'Unnamed'}{isSelf && <em className="cell-you"> (you)</em>}</strong>
                            <small>{u.email}</small>
                            <small className="cell-joined">Joined {formatDate(u.createdAt, 'â€”')}</small>
                          </div>
                        </div>
                      </td>
                      <td data-label="Phone">
                        {u.phone ? <a href={`tel:${u.phone}`} className="cell-link">{u.phone}</a> : 'â€”'}
                      </td>
                      <td data-label="Access">
                        <span className={`badge ${u.role === 'leader' ? 'badge-gold' : ''}`}>
                          {formatRole(u)}
                        </span>
                      </td>
                      <td data-label="Academic">
                        <span className="cell-stack">
                          <strong>
                            {u.courseCode || 'â€”'} Â· {formatYear(u.academicDetails?.yearOfStudy)}
                          </strong>
                          <small>{formatAcademicLevel(u.academicLevel)}</small>
                        </span>
                      </td>
                      <td data-label="Residence">
                        <span className="cell-stack">
                          <strong>{u.area || 'â€”'}</strong>
                          <small>{u.houseNumber}</small>
                        </span>
                      </td>
                      <td data-label="Ministry">{u.ministryWing || 'None'}</td>
                      <td data-label="Membership Fee">
                        <FeeToggle
                          paid={u.membershipFeePaid === true}
                          busy={feeBusy.has(u.id)}
                          disabled={isSelf}
                          name={u.fullName || u.email || 'member'}
                          onToggle={() => toggleFee(u)}
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

      <MemberDrawer
        member={drawerMember}
        isSelf={drawerMember?.id === currentUser.uid}
        feeBusy={drawerMember ? feeBusy.has(drawerMember.id) : false}
        onToggleFee={() => drawerMember && toggleFee(drawerMember)}
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
