import useEngagement, { recentMonths } from '../hooks/useEngagement';
import EngagementChart from './charts/EngagementChart';
import Alert from './Alert';
import { ENGAGEMENT_METRICS } from '../data/constants';

const MONTHS_SHOWN = 6;

/**
 * "Personal Fellowship Engagement Analytics" card: the last six months of a member's
 * leader-recorded attendance, welfare and ministry counts as a pure SVG bar graph.
 */
export default function EngagementPanel({ uid }) {
  const { records, status, loadedAt, retry } = useEngagement(uid);
  const months = recentMonths(loadedAt, MONTHS_SHOWN);
  const recorded = months.filter((m) => records[m.id]);

  const totals = ENGAGEMENT_METRICS.map((metric) => ({
    ...metric,
    total: recorded.reduce((sum, m) => sum + (Number(records[m.id][metric.key]) || 0), 0)
  }));

  return (
    <section className="panel engagement-panel">
      <div className="panel-head engagement-head">
        <div>
          <h3>Personal Fellowship Engagement Analytics</h3>
          <span className="engagement-sw" lang="sw">Mwenendo wa Ushiriki wa Kiroho</span>
        </div>
        <span className="badge">Last {MONTHS_SHOWN} months</span>
      </div>

      {status === 'loading' && (
        <div className="panel-loading">
          <span className="spinner" />
          <span>Loading your engagement...</span>
        </div>
      )}

      {status === 'error' && (
        <Alert type="error">
          Your engagement record could not be loaded.{' '}
          <button type="button" className="btn-link" onClick={retry}>Retry</button>
        </Alert>
      )}

      {status === 'ready' && (
        <>
          <ul className="engagement-totals">
            {totals.map((metric) => (
              <li key={metric.key} style={{ '--metric': metric.color }}>
                <strong>{recorded.length ? metric.total : '—'}</strong>
                <span>{metric.label}</span>
              </li>
            ))}
          </ul>

          <EngagementChart months={months} records={records} />

          {recorded.length === 0 && (
            <p className="engagement-empty">
              No engagement has been recorded for you yet. Fellowship leaders log monthly attendance, welfare
              meetings and ministry service — your bars will appear here once they do.
            </p>
          )}
        </>
      )}
    </section>
  );
}
