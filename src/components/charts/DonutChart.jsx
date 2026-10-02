import { useId, useState } from 'react';
import '../../styles/charts.css';

/**
 * Pure SVG donut chart.
 * segments: [{ key, label, value, color, detail? }]
 * Each arc is a stroked circle using stroke-dasharray/offset, so arcs animate smoothly
 * when values change. A legend with values + percentages sits beside it, and a
 * visually hidden summary is provided for screen readers.
 *
 * Interactive mode (pass `onSegmentClick`): arcs and legend rows become toggle buttons
 * (mouse, touch and keyboard). `activeKey` highlights the selected segment and dims
 * the rest; hovering an arc previews its figures in the centre.
 */
export default function DonutChart({
  segments,
  size = 200,
  thickness = 22,
  centerValue,
  centerLabel,
  title,
  showLegend = true,
  trackColor = '#eef2f6',
  onSegmentClick,
  activeKey = null
}) {
  const titleId = useId();
  const [hoverKey, setHoverKey] = useState(null);
  const interactive = typeof onSegmentClick === 'function';
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 2 : 0;

  // Each arc starts where the previous ones end (prefix sum, no mutation).
  const fractions = segments.map((s) => (total > 0 ? Math.max(0, s.value) / total : 0));
  const arcs = segments.map((segment, index) => {
    const fraction = fractions[index];
    const offset = fractions.slice(0, index).reduce((sum, f) => sum + f, 0) * circumference;
    const length = Math.max(0, fraction * circumference - gap);
    return { ...segment, fraction, length, offset };
  });

  const pctOf = (value) => (total > 0 ? Math.round((value / total) * 100) : 0);
  const summary = segments.map((s) => `${s.label}: ${s.value} (${pctOf(s.value)}%)`).join(', ');

  // Centre shows the hovered (or selected) segment, otherwise the overall figure.
  const focusKey = hoverKey || activeKey;
  const focused = interactive && focusKey ? segments.find((s) => s.key === focusKey) : null;
  const shownValue = focused ? focused.value : centerValue;
  const shownLabel = focused ? `${focused.label} · ${pctOf(focused.value)}%` : centerLabel;

  const toggle = (key) => interactive && onSegmentClick(activeKey === key ? null : key);
  const stateClass = (key) =>
    activeKey ? (activeKey === key ? 'is-active' : 'is-dimmed') : hoverKey && hoverKey !== key ? 'is-dimmed' : '';

  return (
    <figure className={`donut ${interactive ? 'is-interactive' : ''}`.trim()} aria-labelledby={titleId}>
      <div className="donut-visual" style={{ width: size, maxWidth: '100%' }}>
        <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-labelledby={titleId}>
          <title id={titleId}>{title ? `${title}. ${summary}` : summary}</title>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={thickness}
          />
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {arcs.map((arc) =>
              arc.length > 0 ? (
                <circle
                  key={arc.key}
                  className={`donut-arc ${stateClass(arc.key)}`.trim()}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={thickness}
                  style={{ '--arc-width': `${thickness}px`, '--arc-width-hover': `${thickness + 6}px` }}
                  strokeLinecap="butt"
                  strokeDasharray={`${arc.length} ${circumference}`}
                  strokeDashoffset={-arc.offset}
                  {...(interactive && {
                    role: 'button',
                    tabIndex: 0,
                    'aria-pressed': activeKey === arc.key,
                    'aria-label': `${arc.label}: ${arc.value} (${pctOf(arc.value)}%). ${
                      activeKey === arc.key ? 'Click to clear the filter.' : 'Click to filter.'
                    }`,
                    onClick: () => toggle(arc.key),
                    onKeyDown: (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggle(arc.key);
                      }
                    },
                    onMouseEnter: () => setHoverKey(arc.key),
                    onMouseLeave: () => setHoverKey(null),
                    onFocus: () => setHoverKey(arc.key),
                    onBlur: () => setHoverKey(null)
                  })}
                />
              ) : null
            )}
          </g>
        </svg>
        {(shownValue !== undefined || shownLabel) && (
          <div className="donut-center" aria-hidden="true">
            {shownValue !== undefined && <strong>{shownValue}</strong>}
            {shownLabel && <span>{shownLabel}</span>}
          </div>
        )}
      </div>

      {showLegend && (
        <figcaption className="donut-legend">
          <ul>
            {segments.map((segment) => {
              const pct = pctOf(segment.value);
              const content = (
                <>
                  <span className="donut-swatch" style={{ background: segment.color }} aria-hidden="true" />
                  <span className="donut-legend-label">
                    {segment.label}
                    {segment.detail && <small>{segment.detail}</small>}
                  </span>
                  <span className="donut-legend-value">
                    {segment.value}
                    <small>{pct}%</small>
                  </span>
                </>
              );
              return (
                <li key={segment.key} className={stateClass(segment.key)}>
                  {interactive ? (
                    <button
                      type="button"
                      className="donut-legend-btn"
                      aria-pressed={activeKey === segment.key}
                      onClick={() => toggle(segment.key)}
                      onMouseEnter={() => setHoverKey(segment.key)}
                      onMouseLeave={() => setHoverKey(null)}
                    >
                      {content}
                    </button>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        </figcaption>
      )}
    </figure>
  );
}
