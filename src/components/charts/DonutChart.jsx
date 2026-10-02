import { useId } from 'react';
import '../../styles/charts.css';

/**
 * Pure SVG donut chart.
 * segments: [{ key, label, value, color, detail? }]
 * Each arc is a stroked circle using stroke-dasharray/offset, so arcs animate smoothly
 * when values change. A legend with values + percentages sits beside it, and a
 * visually hidden summary is provided for screen readers.
 */
export default function DonutChart({
  segments,
  size = 200,
  thickness = 22,
  centerValue,
  centerLabel,
  title,
  showLegend = true,
  trackColor = '#eef2f6'
}) {
  const titleId = useId();
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

  const summary = segments
    .map((s) => `${s.label}: ${s.value} (${total > 0 ? Math.round((s.value / total) * 100) : 0}%)`)
    .join(', ');

  return (
    <figure className="donut" aria-labelledby={titleId}>
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
                  className="donut-arc"
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={thickness}
                  strokeLinecap="butt"
                  strokeDasharray={`${arc.length} ${circumference}`}
                  strokeDashoffset={-arc.offset}
                />
              ) : null
            )}
          </g>
        </svg>
        {(centerValue !== undefined || centerLabel) && (
          <div className="donut-center" aria-hidden="true">
            {centerValue !== undefined && <strong>{centerValue}</strong>}
            {centerLabel && <span>{centerLabel}</span>}
          </div>
        )}
      </div>

      {showLegend && (
        <figcaption className="donut-legend">
          <ul>
            {segments.map((segment) => {
              const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0;
              return (
                <li key={segment.key}>
                  <span className="donut-swatch" style={{ background: segment.color }} aria-hidden="true" />
                  <span className="donut-legend-label">
                    {segment.label}
                    {segment.detail && <small>{segment.detail}</small>}
                  </span>
                  <span className="donut-legend-value">
                    {segment.value}
                    <small>{pct}%</small>
                  </span>
                </li>
              );
            })}
          </ul>
        </figcaption>
      )}
    </figure>
  );
}
