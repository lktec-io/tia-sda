import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useRegistry from '../../hooks/useRegistry';
import useRegistryPrint from '../../hooks/useRegistryPrint';
import useRoleAnnouncements from '../../hooks/useRoleAnnouncements';
import Alert from '../../components/Alert';
import BrandLogo from '../../components/BrandLogo';
import DonutChart from '../../components/charts/DonutChart';
import GrowthChart from '../../components/charts/GrowthChart';
import {
  ArrowRightIcon,
  DownloadIcon,
  FileIcon,
  MegaphoneIcon,
  SendIcon,
  ShieldIcon,
  UsersIcon,
  WalletIcon
} from '../../components/Icons';
import { FEE_STATUSES, formatTZS } from '../../data/constants';
import { computeLedger, exportRegistryCsv, getRegistryError, membershipGrowth } from '../../lib/registry';
import { formatDate } from '../../utils/format';

/**
 * Leader-only Executive Command Dashboard: dignified analytics (fee-distribution donut,
 * membership growth chart), a quiet KPI strip and one-click executive actions.
 */
export default function ExecutiveOverview() {
  const { userProfile } = useAuth();
  const { members, status, error, retry, loadedAt } = useRegistry();
  const { announcements, recentCount, status: feedStatus } = useRoleAnnouncements();
  const { exportPdf, printPortal, preparing } = useRegistryPrint();
  const [notice, setNotice] = useState({ type: '', text: '' });

  const ledger = useMemo(() => computeLedger(members), [members]);
  const growth = useMemo(() => membershipGrowth(members, loadedAt, 6), [members, loadedAt]);
  const ready = status === 'ready';
  const show = (value) => (ready ? value : '—');
  const collectionRate = ledger.potential > 0 ? Math.round((ledger.revenue / ledger.potential) * 100) : 0;
  const firstName = (userProfile?.fullName || '').split(' ')[0] || 'Leader';
  const latest = announcements.slice(0, 4);
  const addedThisMonth = growth.length ? growth[growth.length - 1].added : 0;

  const feeSegments = FEE_STATUSES.map((s) => ({
    key: s.value,
    label: s.label,
    value: s.value === 'fully_paid' ? ledger.fullyPaid : s.value === 'semester1_paid' ? ledger.semesterPaid : ledger.unpaid,
    color: s.chartColor,
    detail: s.amount ? `${formatTZS(s.amount)} each` : 'Nothing collected yet'
  }));

  const downloadCsv = () => {
    const count = exportRegistryCsv(members, 'tucasa-tia-mbeya-member-list');
    setNotice(
      count
        ? { type: 'success', text: `Downloaded the member list (${count} member${count === 1 ? '' : 's'}).` }
        : { type: 'info', text: 'There are no members to export yet.' }
    );
  };

  const downloadPdf = () => {
    exportPdf([...members].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '')), `All members (${members.length})`);
  };

  return (
    <div className="view exec">
      <section className="exec-head">
        <div className="exec-head-brand">
          <BrandLogo />
          <div>
            <span className="exec-eyebrow">
              <ShieldIcon width={14} height={14} />
              Executive Command Dashboard
            </span>
            <h2>Shalom, {firstName}.</h2>
            <p>
              Membership and treasury at a glance. <em lang="sw">Karibu kwenye kituo cha uongozi.</em>
            </p>
          </div>
        </div>
      </section>

      {status === 'error' && (
        <Alert type="error">
          {getRegistryError(error)}{' '}
          <button type="button" className="btn-link" onClick={retry}>Retry</button>
        </Alert>
      )}
      {notice.text && <Alert type={notice.type}>{notice.text}</Alert>}

      {/* ---------- Quiet KPI strip ---------- */}
      <section className="exec-kpis" aria-label="Key figures">
        <div className="exec-kpi">
          <span className="exec-kpi-label">Registered Active Flock</span>
          <strong className="exec-kpi-value">{show(ledger.total.toLocaleString('en-US'))}</strong>
          <span className="exec-kpi-hint">{show(`+${addedThisMonth} this month`)}</span>
        </div>
        <div className="exec-kpi">
          <span className="exec-kpi-label">Semester Cash Reserves</span>
          <strong className="exec-kpi-value">{show(formatTZS(ledger.revenue))}</strong>
          <span className="exec-kpi-hint">{show(`${formatTZS(ledger.outstanding)} outstanding`)}</span>
        </div>
        <div className="exec-kpi">
          <span className="exec-kpi-label">Collection Rate</span>
          <strong className="exec-kpi-value">{show(`${collectionRate}%`)}</strong>
          <span className="exec-kpi-hint">of {show(formatTZS(ledger.potential))} potential</span>
        </div>
        <div className="exec-kpi">
          <span className="exec-kpi-label">Announcements</span>
          <strong className="exec-kpi-value">{feedStatus === 'ready' ? announcements.length : '—'}</strong>
          <span className="exec-kpi-hint">{feedStatus === 'ready' ? `${recentCount} in the last 48 h` : 'Loading...'}</span>
        </div>
      </section>

      {/* ---------- Analytics ---------- */}
      <section className="exec-analytics" aria-label="Analytics">
        <article className="panel">
          <div className="panel-head">
            <h3><WalletIcon width={18} height={18} /> Fee Status Distribution</h3>
            <span className="exec-chart-sub" lang="sw">Hali ya Ada</span>
          </div>
          {ready ? (
            <DonutChart
              title="Membership fee status distribution"
              segments={feeSegments}
              centerValue={ledger.total}
              centerLabel="members"
            />
          ) : (
            <div className="panel-loading"><span className="spinner" /><span>Loading ledger...</span></div>
          )}
        </article>

        <article className="panel">
          <div className="panel-head">
            <h3><UsersIcon width={18} height={18} /> Membership Growth</h3>
            <span className="exec-chart-sub">Last 6 months</span>
          </div>
          {ready ? (
            <GrowthChart points={growth} title="Membership directory growth over the last six months" />
          ) : (
            <div className="panel-loading"><span className="spinner" /><span>Loading directory...</span></div>
          )}
        </article>
      </section>

      {/* ---------- Quick actions ---------- */}
      <section className="exec-actions" aria-label="Quick actions">
        <Link to="/leader/publish" className="exec-action">
          <span className="exec-action-icon"><SendIcon width={20} height={20} /></span>
          <span className="exec-action-text">
            <strong>Publish an Update</strong>
            <small>Announcement with poster</small>
          </span>
          <ArrowRightIcon width={18} height={18} className="exec-action-arrow" />
        </Link>

        <button type="button" className="exec-action" onClick={downloadPdf} disabled={!ready || members.length === 0 || preparing}>
          <span className="exec-action-icon"><FileIcon width={20} height={20} /></span>
          <span className="exec-action-text">
            <strong>{preparing ? 'Preparing PDF…' : 'Export Registry to PDF'}</strong>
            <small>Branded, print-ready report</small>
          </span>
          <ArrowRightIcon width={18} height={18} className="exec-action-arrow" />
        </button>

        <button type="button" className="exec-action" onClick={downloadCsv} disabled={!ready || members.length === 0}>
          <span className="exec-action-icon"><DownloadIcon width={20} height={20} /></span>
          <span className="exec-action-text">
            <strong>Download Member List</strong>
            <small>Spreadsheet (CSV)</small>
          </span>
          <ArrowRightIcon width={18} height={18} className="exec-action-arrow" />
        </button>

        <Link to="/leader" className="exec-action">
          <span className="exec-action-icon"><ShieldIcon width={20} height={20} /></span>
          <span className="exec-action-text">
            <strong>Command Center</strong>
            <small>Registry & fee ledger</small>
          </span>
          <ArrowRightIcon width={18} height={18} className="exec-action-arrow" />
        </Link>
      </section>

      {/* ---------- Latest posts ---------- */}
      <section className="panel">
        <div className="panel-head">
          <h3><MegaphoneIcon width={18} height={18} /> Latest Announcements</h3>
          <Link to="/leader/publish" className="panel-link">
            Manage <ArrowRightIcon width={15} height={15} />
          </Link>
        </div>
        {feedStatus === 'loading' && (
          <div className="panel-loading">
            <span className="spinner" />
            <span>Loading announcements...</span>
          </div>
        )}
        {feedStatus === 'ready' && latest.length === 0 && (
          <div className="empty-state">
            <MegaphoneIcon width={26} height={26} />
            <p>No announcements published yet.</p>
          </div>
        )}
        {feedStatus === 'ready' && latest.length > 0 && (
          <ul className="exec-posts">
            {latest.map((item) => (
              <li key={item.id}>
                <span className="exec-post-info">
                  <strong>{item.title || 'Untitled announcement'}</strong>
                  <small>{item.category || 'General'} · {formatDate(item.publishedAt)}</small>
                </span>
                <Link to={`/leader/publish/${item.id}`} className="icon-btn" title="Edit Poster/Post" aria-label={`Edit ${item.title || 'announcement'}`}>
                  <FileIcon width={16} height={16} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {printPortal}
    </div>
  );
}
