import { useId } from 'react';
import '../../styles/charts.css';

const WIDTH = 640;
const HEIGHT = 260;
const PAD = { top: 20, right: 20, bottom: 36, left: 40 };

// Rounds the y-axis maximum up to a tidy step so gridlines read cleanly.
const niceMax = (value) => {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 2;
  return Math.ceil(value / step) * step;
};

/**
 * Pure SVG membership growth chart.
 * points: [{ label, added, total }] — bars show new registrations per period,
 * the line + soft area show the cumulative directory size.
 */
export default function GrowthChart({ points, title = 'Membership growth' }) {
  const id = useId();
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const maxY = niceMax(Math.max(1, ...points.map((p) => p.total)));
  const step = points.length > 0 ? plotW / points.length : plotW;
  const barW = Math.min(36, step * 0.46);

  const x = (i) => PAD.left + step * i + step / 2;
  const y = (v) => PAD.top + plotH - (v / maxY) * plotH;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.total)}`).join(' ');
  const areaPath = points.length
    ? `${linePath} L${x(points.length - 1)},${PAD.top + plotH} L${x(0)},${PAD.top + plotH} Z`
    : '';
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));

  return (
    <figure className="growth">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${id}-t ${id}-d`} preserveAspectRatio="xMidYMid meet">
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>
          {points.map((p) => `${p.label}: ${p.added} new, ${p.total} total`).join('; ')}
        </desc>

        <defs>
          <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a446c" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#1a446c" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines + y-axis labels */}
        {grid.map((value) => (
          <g key={value}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(value)} y2={y(value)} className="growth-grid" />
            <text x={PAD.left - 8} y={y(value) + 4} className="growth-axis" textAnchor="end">
              {value}
            </text>
          </g>
        ))}

        {/* New registrations per period */}
        {points.map((p, i) => (
          <rect
            key={`bar-${p.label}`}
            className="growth-bar"
            x={x(i) - barW / 2}
            y={y(p.added)}
            width={barW}
            height={Math.max(0, PAD.top + plotH - y(p.added))}
            rx="3"
          />
        ))}

        {/* Cumulative directory size */}
        {areaPath && <path d={areaPath} fill={`url(#${id}-area)`} />}
        {linePath && <path d={linePath} className="growth-line" />}
        {points.map((p, i) => (
          <circle key={`pt-${p.label}`} cx={x(i)} cy={y(p.total)} r="4.5" className="growth-point" />
        ))}

        {/* X labels */}
        {points.map((p, i) => (
          <text key={`lbl-${p.label}`} x={x(i)} y={HEIGHT - 12} className="growth-axis" textAnchor="middle">
            {p.label}
          </text>
        ))}
      </svg>

      <figcaption className="growth-legend">
        <span><i className="growth-key growth-key-line" aria-hidden="true" /> Total members</span>
        <span><i className="growth-key growth-key-bar" aria-hidden="true" /> New registrations</span>
      </figcaption>
    </figure>
  );
}
