import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useRegistry from '../../hooks/useRegistry';
import useRoleAnnouncements from '../../hooks/useRoleAnnouncements';
import Alert from '../../components/Alert';
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
import { FEE_ANNUAL_TZS, formatTZS } from '../../data/constants';
import { computeLedger, exportRegistryCsv, getRegistryError } from '../../lib/registry';
import { formatDate } from '../../utils/format';

/**
 * Leader-only Executive Command Dashboard (replaces the member overview for leaders):
 * headline flock + treasury figures and one-click executive actions.
 */
export default function ExecutiveOverview() {
  const { userProfile } = useAuth();
  const { members, status, error, retry } = useRegistry();
  const { announcements, recentCount, status: feedStatus } = useRoleAnnouncements();
  const [notice, setNotice] = useState({ type: '', text: '' });

  const ledger = useMemo(() => computeLedger(members), [members]);
  const ready = status === 'ready';
  const show = (value) => (ready ? value : '—');
  const collectionRate = ledger.potential > 0 ? Math.round((ledger.revenue / ledger.potential) * 100) : 0;
  const firstName = (userProfile?.fullName || '').split(' ')[0] || 'Leader';
  const latest = announcements.slice(0, 4);

  const downloadList = () => {
    const count = exportRegistryCsv(members, 'tucasa-tia-mbeya-member-list');
    setNotice(
      count
        ? { type: 'success', text: `Downloaded the member list (${count} member${count === 1 ? '' : 's'}).` }
        : { type: 'info', text: 'There are no members to export yet.' }
    );
  };

  return (
    <div className="view exec">
      <section className="exec-hero">
        <div className="exec-hero-copy">
          <span className="exec-eyebrow">
            <ShieldIcon width={14} height={14} />
            Executive Command Dashboard
          </span>
          <h2>Shalom, {firstName}.</h2>
          <p>
            A live view of the TUCASA TIA Mbeya flock and treasury. <em lang="sw">Karibu kwenye kituo cha uongozi.</em>
          </p>
        </div>
        <div className="exec-hero-rate" aria-label={`${collectionRate}% of annual fees collected`}>
          <strong>{show(`${collectionRate}%`)}</strong>
          <span>of annual fees collected</span>
        </div>
      </section>

      {status === 'error' && (
        <Alert type="error">
          {getRegistryError(error)}{' '}
          <button type="button" className="btn-link" onClick={retry}>Retry</button>
        </Alert>
      )}
      {notice.text && <Alert type={notice.type}>{notice.text}</Alert>}

      {/* ---------- Headline metrics ---------- */}
      <section className="exec-metrics" aria-label="Executive metrics">
        <article className="exec-metric exec-metric-flock">
          <span className="exec-metric-icon"><UsersIcon width={22} height={22} /></span>
          <span className="exec-metric-label">Total Registered Active Flock</span>
          <strong className="exec-metric-value">{show(ledger.total.toLocaleString('en-US'))}</strong>
          <span className="exec-metric-hint">{show(`${ledger.fullyPaid} fully paid · ${ledger.semesterPaid} semester 1 · ${ledger.unpaid} unpaid`)}</span>
        </article>

        <article className="exec-metric exec-metric-cash">
          <span className="exec-metric-icon"><WalletIcon width={22} height={22} /></span>
          <span className="exec-metric-label">Total Collected Semester Cash Reserves</span>
          <strong className="exec-metric-value">{show(formatTZS(ledger.revenue))}</strong>
          <div className="exec-meter" aria-hidden="true">
            <span style={{ width: `${ready ? collectionRate : 0}%` }} />
          </div>
          <span className="exec-metric-hint">
            {show(`${formatTZS(ledger.outstanding)} outstanding of ${formatTZS(ledger.potential)} (${formatTZS(FEE_ANNUAL_TZS)} / member)`)}
          </span>
        </article>

        <article className="exec-metric exec-metric-posts">
          <span className="exec-metric-icon"><MegaphoneIcon width={22} height={22} /></span>
          <span className="exec-metric-label">Announcements Published</span>
          <strong className="exec-metric-value">{feedStatus === 'ready' ? announcements.length : '—'}</strong>
          <span className="exec-metric-hint">
            {feedStatus === 'ready' ? `${recentCount} in the last 48 hours` : 'Loading...'}
          </span>
        </article>
      </section>

      {/* ---------- Quick actions ---------- */}
      <section className="exec-actions" aria-label="Quick actions">
        <Link to="/leader/publish" className="exec-action exec-action-primary">
          <span className="exec-action-icon"><SendIcon width={20} height={20} /></span>
          <span className="exec-action-text">
            <strong>Publish an Update</strong>
            <small>Announcement with poster & audience</small>
          </span>
          <ArrowRightIcon width={18} height={18} className="exec-action-arrow" />
        </Link>

        <button type="button" className="exec-action" onClick={downloadList} disabled={!ready || members.length === 0}>
          <span className="exec-action-icon"><DownloadIcon width={20} height={20} /></span>
          <span className="exec-action-text">
            <strong>Download Member List</strong>
            <small>Full registry as CSV (Excel-ready)</small>
          </span>
          <ArrowRightIcon width={18} height={18} className="exec-action-arrow" />
        </button>

        <Link to="/leader" className="exec-action">
          <span className="exec-action-icon"><ShieldIcon width={20} height={20} /></span>
          <span className="exec-action-text">
            <strong>Open Command Center</strong>
            <small>Registry, fee ledger & member files</small>
          </span>
          <ArrowRightIcon width={18} height={18} className="exec-action-arrow" />
        </Link>
      </section>

      {/* ---------- Latest posts ---------- */}
      <section className="panel">
        <div className="panel-head">
          <h3>Latest Announcements</h3>
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
    </div>
  );
}
