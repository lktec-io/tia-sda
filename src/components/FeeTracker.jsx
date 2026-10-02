import DonutChart from './charts/DonutChart';
import { CheckIcon } from './Icons';
import { FEE_ANNUAL_TZS, FEE_PER_SEMESTER_TZS, feeStatusInfo, formatTZS } from '../data/constants';

/**
 * Member-facing fee obligation block: a soft progress arc (paid vs remaining of the
 * annual 5,000 TZS) beside the semester checklist and guidance message.
 */
export default function FeeTracker({ status }) {
  const info = feeStatusInfo(status);
  const remaining = FEE_ANNUAL_TZS - info.amount;
  const sem1Done = info.amount >= FEE_PER_SEMESTER_TZS;
  const sem2Done = info.amount >= FEE_ANNUAL_TZS;

  return (
    <section className="fee-arc-card" aria-labelledby="fee-arc-title">
      <DonutChart
        size={168}
        thickness={14}
        showLegend={false}
        title="Annual membership fee progress"
        centerValue={`${info.percent}%`}
        centerLabel="of annual fee"
        segments={[
          { key: 'paid', label: 'Paid', value: info.amount, color: '#1a446c' },
          { key: 'remaining', label: 'Remaining', value: remaining, color: '#eef2f6' }
        ]}
      />

      <div className="fee-arc-body">
        <h3 id="fee-arc-title">Membership Fee Status</h3>
        <span className="fee-arc-sw" lang="sw">Hali ya Ada ya Mwanachama</span>

        <div className="fee-arc-amount">
          <strong>{formatTZS(info.amount)}</strong>
          <span>paid of {formatTZS(FEE_ANNUAL_TZS)} this year</span>
        </div>

        <ul className="fee-arc-steps">
          <li className={sem1Done ? 'is-done' : ''}>
            <span className="fee-arc-check" aria-hidden="true">{sem1Done && <CheckIcon width={12} height={12} />}</span>
            Semester 1 · {formatTZS(FEE_PER_SEMESTER_TZS)}
            <span className="sr-only">{sem1Done ? '(paid)' : '(not yet paid)'}</span>
          </li>
          <li className={sem2Done ? 'is-done' : ''}>
            <span className="fee-arc-check" aria-hidden="true">{sem2Done && <CheckIcon width={12} height={12} />}</span>
            Semester 2 · {formatTZS(FEE_PER_SEMESTER_TZS)}
            <span className="sr-only">{sem2Done ? '(paid)' : '(not yet paid)'}</span>
          </li>
        </ul>

        <p className="fee-arc-message">
          <em>{info.message}</em>
        </p>
      </div>
    </section>
  );
}
