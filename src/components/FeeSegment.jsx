import { useId } from 'react';
import { FEE_STATUSES } from '../data/constants';

/**
 * 3-tier segmented radio control for a member's fee status:
 * Unpaid · Semester 1 Paid · Fully Paid. Built on native radio inputs, so arrow
 * keys and screen readers work out of the box. `size="sm"` is the compact
 * table variant (short labels).
 */
export default function FeeSegment({ value, onChange, busy = false, disabled = false, size = 'md', label = 'Membership fee status' }) {
  const name = useId();
  const activeIndex = Math.max(0, FEE_STATUSES.findIndex((s) => s.value === value));
  const tone = FEE_STATUSES[activeIndex].tone;

  return (
    <div
      className={`fee-segment fee-segment-${size} fee-segment-${tone} ${busy ? 'is-busy' : ''}`.trim()}
      role="radiogroup"
      aria-label={label}
      aria-busy={busy}
      style={{ '--seg-index': activeIndex }}
      title={disabled ? 'Leaders cannot change their own fee status' : undefined}
    >
      <span className="fee-segment-thumb" aria-hidden="true" />
      {FEE_STATUSES.map((status) => (
        <label key={status.value} className={`fee-segment-option ${status.value === value ? 'is-active' : ''}`}>
          <input
            type="radio"
            name={name}
            value={status.value}
            checked={status.value === value}
            onChange={() => onChange(status.value)}
            disabled={disabled || busy}
          />
          <span>{size === 'sm' ? status.short : status.label}</span>
        </label>
      ))}
    </div>
  );
}
