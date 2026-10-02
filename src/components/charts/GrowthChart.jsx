import { useId, useState } from 'react';
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
 * points: [{ id, label, added, total }] — bars show new registrations per period,
 * the line + soft area show the cumulative directory size.
 *
 * Interactive mode (pass `onPointClick`): each month column is a toggle button;
 * hovering shows a tooltip, clicking selects the month (`activeId`) so the caller can
 * filter by it. Clicking the selected month again clears it (calls with null).
 */
export default function GrowthChart({ points, title = 'Membership growth', onPointClick, activeId = null }) {
  const id = useId();
  const [hoverIndex, setHoverIndex] = useState(null);
  const interactive = typeof onPointClick === 'function';
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

  const toggle = (point) => interactive && onPointClick(activeId === point.id ? null : point);
  const barClass = (point, i) => {
    if (activeId) return activeId === point.id ? 'is-active' : 'is-dimmed';
    return hoverIndex === i ? 'is-hover' : '';
  };
  const tip = hoverIndex != null ? points[hoverIndex] : null;
  const tipX = tip ? Math.min(Math.max(x(hoverIndex), PAD.left + 70), WIDTH - PAD.right - 70) : 0;

  return (
    <figure className={`growth ${interactive ? 'is-interactive' : ''}`.trim()}>
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

        {/* Selected-month column highlight */}
        {points.map((p, i) =>
          activeId === p.id ? (
            <rect
              key={`sel-${p.id}`}
              className="growth-selected"
              x={PAD.left + step * i + 4}
              y={PAD.top}
              width={step - 8}
              height={plotH}
              rx="4"
            />
          ) : null
        )}

        {/* New registrations per period */}
        {points.map((p, i) => (
          <rect
            key={`bar-${p.id || p.label}`}
            className={`growth-bar ${barClass(p, i)}`.trim()}
            x={x(i) - barW / 2}
            y={y(p.added)}
            width={barW}
            height={Math.max(0, PAD.top + plotH - y(p.added))}
            rx="3"
          />
        ))}

        {/* Cumulative directory size */}
        {areaPath && <path d={areaPath} fill={`url(#${id}-area)`} pointerEvents="none" />}
        {linePath && <path d={linePath} className="growth-line" pointerEvents="none" />}
        {points.map((p, i) => (
          <circle
            key={`pt-${p.id || p.label}`}
            cx={x(i)}
            cy={y(p.total)}
            r={hoverIndex === i || activeId === p.id ? 6 : 4.5}
            className="growth-point"
            pointerEvents="none"
          />
        ))}

        {/* X labels */}
        {points.map((p, i) => (
          <text
            key={`lbl-${p.id || p.label}`}
            x={x(i)}
            y={HEIGHT - 12}
            className={`growth-axis ${activeId === p.id ? 'is-active' : ''}`.trim()}
            textAnchor="middle"
          >
            {p.label}
          </text>
        ))}

        {/* Full-height hit areas: easy to click even when a bar is tiny. */}
        {interactive &&
          points.map((p, i) => (
            <rect
              key={`hit-${p.id || p.label}`}
              className="growth-hit"
              x={PAD.left + step * i}
              y={PAD.top}
              width={step}
              height={plotH + 24}
              role="button"
              tabIndex={0}
              aria-pressed={activeId === p.id}
              aria-label={`${p.label}: ${p.added} new, ${p.total} total. ${
                activeId === p.id ? 'Click to clear the filter.' : 'Click to show members who joined this month.'
              }`}
              onClick={() => toggle(p)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle(p);
                }
              }}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              onFocus={() => setHoverIndex(i)}
              onBlur={() => setHoverIndex(null)}
            />
          ))}

        {/* Hover tooltip */}
        {interactive && tip && (
          <g className="growth-tip" transform={`translate(${tipX}, ${PAD.top + 2})`} pointerEvents="none">
            <rect x="-66" y="0" width="132" height="44" rx="6" />
            <text x="0" y="18" textAnchor="middle" className="growth-tip-title">{tip.label}</text>
            <text x="0" y="34" textAnchor="middle" className="growth-tip-body">
              +{tip.added} new · {tip.total} total
            </text>
          </g>
        )}
      </svg>

      <figcaption className="growth-legend">
        <span><i className="growth-key growth-key-line" aria-hidden="true" /> Total members</span>
        <span><i className="growth-key growth-key-bar" aria-hidden="true" /> New registrations</span>
        {interactive && <span className="growth-hint">Click a month to filter the registry</span>}
      </figcaption>
    </figure>
  );
}
