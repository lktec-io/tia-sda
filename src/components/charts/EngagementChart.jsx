import { useId } from 'react';
import { ENGAGEMENT_METRICS } from '../../data/constants';
import '../../styles/charts.css';

const WIDTH = 560;
const HEIGHT = 250;
const PAD = { top: 18, right: 14, bottom: 34, left: 34 };

const niceMax = (value) => (value <= 4 ? 4 : Math.ceil(value / 2) * 2);

/**
 * Pure SVG grouped bar chart of a member's monthly fellowship engagement.
 * months: [{ id: 'YYYY-MM', label: 'Oct' }]; records: { 'YYYY-MM': { attendance, welfare, ministry } }.
 * Months with no record render as an empty slot (never as fabricated zeros in the summary).
 */
export default function EngagementChart({ months, records, title = 'Personal fellowship engagement' }) {
  const id = useId();
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const values = months.flatMap((m) => ENGAGEMENT_METRICS.map((metric) => Number(records[m.id]?.[metric.key]) || 0));
  const maxY = niceMax(Math.max(1, ...values));
  const step = months.length > 0 ? plotW / months.length : plotW;
  const groupW = Math.min(66, step * 0.72);
  const barW = groupW / ENGAGEMENT_METRICS.length;

  const y = (v) => PAD.top + plotH - (v / maxY) * plotH;
  const grid = [0, 0.5, 1].map((f) => Math.round(maxY * f));

  const description = months
    .map((m) => {
      const record = records[m.id];
      if (!record) return `${m.label}: not recorded`;
      return `${m.label}: ${ENGAGEMENT_METRICS.map((metric) => `${metric.label} ${record[metric.key] ?? 0}`).join(', ')}`;
    })
    .join('; ');

  return (
    <figure className="engagement">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-t ${id}-d`} preserveAspectRatio="xMidYMid meet">
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>{description}</desc>

        <defs>
          {ENGAGEMENT_METRICS.map((metric) => (
            <linearGradient key={metric.key} id={`${id}-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metric.color} stopOpacity="1" />
              <stop offset="100%" stopColor={metric.color} stopOpacity="0.62" />
            </linearGradient>
          ))}
        </defs>

        {grid.map((value) => (
          <g key={value}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(value)} y2={y(value)} className="growth-grid" />
            <text x={PAD.left - 8} y={y(value) + 4} className="growth-axis" textAnchor="end">
              {value}
            </text>
          </g>
        ))}

        {months.map((m, i) => {
          const record = records[m.id];
          const groupX = PAD.left + step * i + (step - groupW) / 2;
          return (
            <g key={m.id} className={record ? 'engagement-group' : 'engagement-group is-empty'}>
              {record ? (
                ENGAGEMENT_METRICS.map((metric, j) => {
                  const value = Number(record[metric.key]) || 0;
                  return (
                    <rect
                      key={metric.key}
                      className="engagement-bar"
                      style={{ animationDelay: `${i * 70 + j * 40}ms` }}
                      x={groupX + j * barW + 1}
                      y={y(value)}
                      width={Math.max(2, barW - 2)}
                      height={Math.max(0, PAD.top + plotH - y(value))}
                      rx="2.5"
                      fill={`url(#${id}-${metric.key})`}
                    >
                      <title>{`${m.label} · ${metric.label}: ${value}`}</title>
                    </rect>
                  );
                })
              ) : (
                <rect
                  className="engagement-placeholder"
                  x={groupX}
                  y={PAD.top + plotH - 6}
                  width={groupW}
                  height="6"
                  rx="3"
                />
              )}
              <text x={PAD.left + step * i + step / 2} y={HEIGHT - 10} className="growth-axis" textAnchor="middle">
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="engagement-legend">
        {ENGAGEMENT_METRICS.map((metric) => (
          <span key={metric.key}>
            <i className="engagement-key" style={{ background: metric.color }} aria-hidden="true" />
            {metric.label}
            <small lang="sw">{metric.sw}</small>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
