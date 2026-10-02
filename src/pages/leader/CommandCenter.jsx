import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { DIRECTORY_COLLECTION } from '../../lib/directory';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import Alert from '../../components/Alert';
import ConfirmDialog from '../../components/ConfirmDialog';
import MemberAvatar from '../../components/MemberAvatar';
import MemberDrawer from '../../components/MemberDrawer';
import FeeSegment from '../../components/FeeSegment';
import DonutChart from '../../components/charts/DonutChart';
import GrowthChart from '../../components/charts/GrowthChart';
import PublishedAnnouncements from './PublishedAnnouncements';
import {
  ChevronDownIcon,
  CloseIcon,
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
  formatYear,
  ministryLabel
} from '../../data/constants';
import useRegistry from '../../hooks/useRegistry';
import useRegistryPrint from '../../hooks/useRegistryPrint';
import { computeLedger, exportRegistryCsv, getRegistryError, membershipGrowth, monthBounds } from '../../lib/registry';
import { formatDate, toMillis } from '../../utils/format';
import '../../styles/leader.css';

const getDbError = getRegistryError;
const FEE_VALUES = FEE_STATUSES.map((s) => s.value);

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

/** Numbered macro section: one clear purpose per block, generous spacing. */
function MacroSection({ step, title, sw, lead, id, children, aside }) {
  return (
    <section className="cc-section" aria-labelledby={`${id}-title`} id={id}>
      <header className="cc-section-head">
        <span className="cc-step" aria-hidden="true">{step}</span>
        <div className="cc-section-text">
          <h3 id={`${id}-title`}>
            {title}
            {sw && <span lang="sw"> / {sw}</span>}
          </h3>
          {lead && <p>{lead}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
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

/**
 * /leader — Leadership Command Center, organised as four macro sections:
 *  01 Treasury & Community · 02 Interactive Analytics · 03 Member Registry · 04 Announcements.
 * Clicking a donut slice or a growth-chart month filters the registry table instantly.
 * Deep links: /leader?fee=unpaid|semester1_paid|fully_paid and /leader?joined=YYYY-MM.
 */
export default function CommandCenter() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  // Live, enriched registry shared with the Executive Overview (see hooks/useRegistry).
  const { members: registry, status, error: loadError, retry: retryRegistry, loadedAt } = useRegistry();
  const { exportPdf, printPortal, preparing: preparingPdf } = useRegistryPrint();
  const registryRef = useRef(null);

  const [search, setSearch] = useState('');
  const [feeFilter, setFeeFilter] = useState(() =>
    FEE_VALUES.includes(searchParams.get('fee')) ? searchParams.get('fee') : 'all'
  );
  // { id: 'YYYY-MM', start, next, label } from a growth-chart click (or ?joined=).
  const [joinedFilter, setJoinedFilter] = useState(() => {
    const id = searchParams.get('joined');
    const bounds = monthBounds(id);
    return bounds ? { id, ...bounds } : null;
  });
  const [levelFilter, setLevelFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [feeBusy, setFeeBusy] = useState(() => new Set());
  const [memberToDelete, setMemberToDelete] = useState(null); // member object
  const [deleting, setDeleting] = useState(false);
  const [drawerId, setDrawerId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const ready = status === 'ready';

  // Live treasury ledger + growth series from the whole registry.
  const ledger = useMemo(() => computeLedger(registry), [registry]);
  const growth = useMemo(() => membershipGrowth(registry, loadedAt, 6), [registry, loadedAt]);

  const feeSegments = FEE_STATUSES.map((s) => ({
    key: s.value,
    label: s.label,
    value: s.value === 'fully_paid' ? ledger.fullyPaid : s.value === 'semester1_paid' ? ledger.semesterPaid : ledger.unpaid,
    color: s.chartColor,
    detail: s.amount ? `${formatTZS(s.amount)} each` : 'Nothing collected yet'
  }));

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
      .filter((u) => {
        if (!joinedFilter) return true;
        const joined = toMillis(u.createdAt);
        return joined >= joinedFilter.start && joined < joinedFilter.next;
      })
      .filter((u) => levelFilter === 'all' || u.academicLevel === levelFilter)
      .filter((u) => courseFilter === 'all' || u.courseCode === courseFilter)
      .filter((u) => yearFilter === 'all' || u.academicDetails?.yearOfStudy === yearFilter)
      .filter((u) => areaFilter === 'all' || u.area === areaFilter)
      .filter((u) => {
        if (!term) return true;
        return [u.fullName, u.courseCode, u.courseName, u.email, u.phone, u.area, u.houseNumber]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  }, [registry, search, feeFilter, joinedFilter, levelFilter, courseFilter, yearFilter, areaFilter]);

  const drawerMember = drawerId ? registry.find((u) => u.id === drawerId) || null : null;
  const advancedCount = [levelFilter, courseFilter, yearFilter, areaFilter].filter((v) => v !== 'all').length;
  const filtersActive = Boolean(search || feeFilter !== 'all' || joinedFilter || advancedCount);

  const clearFilters = () => {
    setSearch('');
    setFeeFilter('all');
    setJoinedFilter(null);
    setLevelFilter('all');
    setCourseFilter('all');
    setYearFilter('all');
    setAreaFilter('all');
  };

  // Chart → registry: a click narrows the table; clicking the same slice/month again clears it.
  const applyFeeSlice = (key) => setFeeFilter(key || 'all');
  const applyGrowthMonth = (point) =>
    setJoinedFilter(point ? { id: point.id, start: point.start, next: point.next, label: monthBounds(point.id)?.label || point.label } : null);
  const jumpToRegistry = () => registryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

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
      // Profile + Flock Directory card go together (deleting a missing card is a no-op).
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', memberToDelete.id));
      batch.delete(doc(db, DIRECTORY_COLLECTION, memberToDelete.id));
      await batch.commit();
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

  const activeChips = [
    feeFilter !== 'all' && { key: 'fee', label: `Fee: ${feeStatusInfo(feeFilter).label}`, clear: () => setFeeFilter('all') },
    joinedFilter && { key: 'joined', label: `Joined: ${joinedFilter.label}`, clear: () => setJoinedFilter(null) },
    search.trim() && { key: 'search', label: `“${search.trim()}”`, clear: () => setSearch('') }
  ].filter(Boolean);

  return (
    <div className="view cc">
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

      {/* ---------- 01 Treasury & community ---------- */}
      <MacroSection
        step="01"
        id="cc-treasury"
        title="Treasury & Community"
        sw="Hazina na Jumuiya"
        lead="Collected fees, outstanding balances and the size of the flock — updated live."
      >
        <TreasuryInsights ledger={ledger} ready={ready} />

        <div className="metric-grid" aria-label="Community analytics">
          <MetricCard
            tone="blue"
            icon={<UsersIcon width={20} height={20} />}
            label="Total Registered Community"
            value={ready ? metrics.total : '—'}
            hint={ready ? `${metrics.feesPaid} fully paid for the year` : 'Loading...'}
          />
          <MetricCard
            tone="gold"
            icon={<WalletIcon width={20} height={20} />}
            label="Not Yet Fully Paid"
            value={ready ? metrics.feesOutstanding : '—'}
            hint={metrics.feesOutstanding > 0 ? 'Unpaid or Semester 1 only' : 'Everyone is paid up'}
          />
          <MetricCard
            tone="green"
            icon={<MusicIcon width={20} height={20} />}
            label="Active Choir Members"
            value={ready ? metrics.choir : '—'}
            hint="Registered under TUCASA Choir"
          />
        </div>
      </MacroSection>

      {/* ---------- 02 Interactive analytics ---------- */}
      <MacroSection
        step="02"
        id="cc-analytics"
        title="Interactive Analytics"
        sw="Takwimu"
        lead="Click a fee slice or a month to filter the member registry below. Click it again to clear."
      >
        <div className="cc-analytics">
          <article className="panel">
            <div className="panel-head">
              <h3><WalletIcon width={18} height={18} /> Fee Status Distribution</h3>
              {feeFilter !== 'all' && (
                <button type="button" className="btn-link" onClick={() => setFeeFilter('all')}>Clear</button>
              )}
            </div>
            {ready ? (
              <DonutChart
                title="Membership fee status distribution"
                segments={feeSegments}
                centerValue={ledger.total}
                centerLabel="members"
                activeKey={feeFilter === 'all' ? null : feeFilter}
                onSegmentClick={applyFeeSlice}
              />
            ) : (
              <div className="panel-loading"><span className="spinner" /><span>Loading ledger...</span></div>
            )}
          </article>

          <article className="panel">
            <div className="panel-head">
              <h3><UsersIcon width={18} height={18} /> Membership Growth</h3>
              {joinedFilter ? (
                <button type="button" className="btn-link" onClick={() => setJoinedFilter(null)}>Clear</button>
              ) : (
                <span className="exec-chart-sub">Last 6 months</span>
              )}
            </div>
            {ready ? (
              <GrowthChart
                points={growth}
                title="Membership growth over the last six months"
                activeId={joinedFilter?.id ?? null}
                onPointClick={applyGrowthMonth}
              />
            ) : (
              <div className="panel-loading"><span className="spinner" /><span>Loading directory...</span></div>
            )}
          </article>
        </div>

        {(feeFilter !== 'all' || joinedFilter) && ready && (
          <div className="cc-filter-banner" role="status">
            <span>
              Registry filtered to <strong>{filteredUsers.length}</strong> member{filteredUsers.length === 1 ? '' : 's'}
              {feeFilter !== 'all' && <> · {feeStatusInfo(feeFilter).label}</>}
              {joinedFilter && <> · joined {joinedFilter.label}</>}
            </span>
            <button type="button" className="btn btn-outline btn-sm" onClick={jumpToRegistry}>
              <span>View registry</span>
              <ChevronDownIcon width={15} height={15} />
            </button>
          </div>
        )}
      </MacroSection>

      {/* ---------- 03 Member registry ---------- */}
      <div ref={registryRef} className="cc-anchor">
        <MacroSection
          step="03"
          id="cc-registry"
          title="Member Registry"
          sw="Daftari la Washiriki"
          lead="Search, filter, update fee status, open full member files and export."
          aside={
            <span className="registry-count">
              Showing {filteredUsers.length} of {registry.length}
            </span>
          }
        >
          <div className="panel registry">
            <div className="registry-filters-main">
              <label className="filter filter-search">
                <span className="sr-only">Search members</span>
                <SearchIcon width={17} height={17} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by full name or course (also email, phone, area)"
                />
              </label>

              <div className="fee-chips" role="group" aria-label="Filter by membership fee">
                {[{ value: 'all', label: 'All' }, ...FEE_STATUSES].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    className={`chip ${feeFilter === s.value ? 'is-active' : ''}`}
                    aria-pressed={feeFilter === s.value}
                    onClick={() => setFeeFilter(s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className={`btn btn-outline btn-sm advanced-toggle ${showAdvanced ? 'is-open' : ''}`}
                aria-expanded={showAdvanced}
                aria-controls="cc-advanced-filters"
                onClick={() => setShowAdvanced((open) => !open)}
              >
                <span>More filters{advancedCount ? ` (${advancedCount})` : ''}</span>
                <ChevronDownIcon width={15} height={15} />
              </button>
            </div>

            <div id="cc-advanced-filters" className="registry-filters" hidden={!showAdvanced}>
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
              <div className="active-chips">
                {activeChips.map((chip) => (
                  <button key={chip.key} type="button" className="active-chip" onClick={chip.clear} aria-label={`Remove filter ${chip.label}`}>
                    <span>{chip.label}</span>
                    <CloseIcon width={12} height={12} />
                  </button>
                ))}
                {filtersActive ? (
                  <button type="button" className="btn-link" onClick={clearFilters}>Clear all</button>
                ) : (
                  <span className="registry-toolbar-note">Newest registrations are listed first.</span>
                )}
              </div>

              <div className="registry-exports">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    exportPdf(
                      filteredUsers,
                      filtersActive ? `Filtered view (${filteredUsers.length} of ${registry.length})` : `All members (${registry.length})`
                    )
                  }
                  disabled={!ready || filteredUsers.length === 0 || preparingPdf}
                >
                  <FileIcon width={16} height={16} />
                  <span>{preparingPdf ? 'Preparing PDF…' : 'Export PDF'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={exportCsv}
                  disabled={!ready || filteredUsers.length === 0}
                >
                  <DownloadIcon width={16} height={16} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {message.text && <Alert type={message.type}>{message.text}</Alert>}

            {status === 'loading' && (
              <div className="panel-loading">
                <span className="spinner" />
                <span>Loading member registry...</span>
              </div>
            )}

            {ready && filteredUsers.length === 0 && (
              <div className="empty-state">
                <UsersIcon width={28} height={28} />
                <p>{registry.length === 0 ? 'No one has registered yet.' : 'No members match these filters.'}</p>
              </div>
            )}

            {ready && filteredUsers.length > 0 && (
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
                          <td data-label="Ministry">{ministryLabel(u.ministryWing)}</td>
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
          </div>
        </MacroSection>
      </div>

      {/* ---------- 04 Announcements ---------- */}
      <MacroSection
        step="04"
        id="cc-announcements"
        title="Announcements"
        sw="Matangazo"
        lead="Search, edit or delete published posts."
      >
        <PublishedAnnouncements />
      </MacroSection>

      {printPortal}

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
        cancelLabel="No, keep this member"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
