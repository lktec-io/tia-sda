import { CheckIcon, WalletIcon } from './Icons';
import { FEE_ANNUAL_TZS, FEE_STATUSES, feeStatusInfo, formatTZS } from '../data/constants';

/**
 * Member-facing semester fee progress tracker:
 * unpaid → 0% amber · semester1_paid → 50% sapphire · fully_paid → 100% emerald.
 */
export default function FeeTracker({ status }) {
  const info = feeStatusInfo(status);
  const paidIndex = FEE_STATUSES.findIndex((s) => s.value === info.value);

  return (
    <section className={`fee-tracker fee-tone-${info.tone}`} aria-labelledby="fee-tracker-title">
      <div className="fee-tracker-head">
        <span className="fee-tracker-icon">
          <WalletIcon width={20} height={20} />
        </span>
        <div className="fee-tracker-titles">
          <h3 id="fee-tracker-title">Membership Fee Status</h3>
          <span lang="sw">Hali ya Ada ya Mwanachama</span>
        </div>
        <div className="fee-tracker-amount">
          <strong>{formatTZS(info.amount)}</strong>
          <span>of {formatTZS(FEE_ANNUAL_TZS)}</span>
        </div>
      </div>

      <div
        className="fee-tracker-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={info.percent}
        aria-valuetext={`${info.percent}% — ${info.label}`}
      >
        <span className="fee-tracker-fill" style={{ width: `${info.percent}%` }} />
        <span className="fee-tracker-midpoint" aria-hidden="true" />
      </div>

      <ol className="fee-tracker-steps" aria-hidden="true">
        {FEE_STATUSES.map((step, index) => {
          const done = index > 0 && index <= paidIndex;
          return (
            <li key={step.value} className={done ? 'is-done' : ''}>
              <span className="fee-tracker-dot">{done && <CheckIcon width={11} height={11} />}</span>
              {index === 0 ? 'Start' : step.label}
            </li>
          );
        })}
      </ol>

      <p className="fee-tracker-message">
        <em>{info.message}</em>
      </p>
    </section>
  );
}
