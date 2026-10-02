import { ClockIcon } from './Icons';
import { ROSTER_SECTIONS, dayOfWeek, formatRosterDate } from '../lib/worship';

/**
 * Read-only duty sheet for one Sabbath week: mid-week services (with their own dates),
 * Sabbath School and Divine Service, each headed by its local start time.
 * Unassigned duties show as "To be assigned".
 */
export default function RosterSheet({ roster, compact = false }) {
  return (
    <div className={`roster-sheet ${compact ? 'roster-sheet-compact' : ''}`.trim()}>
      {ROSTER_SECTIONS.map((section) => (
        <section key={section.key} className={`roster-block roster-${section.key}`}>
          <header className="roster-block-head">
            <h4>
              {section.title}
              <span lang="sw">{section.sw}</span>
            </h4>
            {section.time && (
              <span className="roster-time">
                <ClockIcon width={13} height={13} />
                <span lang="sw">{section.time}</span>
                <small>· {section.clock}</small>
              </span>
            )}
          </header>

          <dl className="roster-duties">
            {section.fields.map((field) => {
              const value = roster?.[section.key]?.[field.key]?.trim();
              const day = field.dayOffset != null ? dayOfWeek(roster?.sabatoDate, field.dayOffset) : null;
              return (
                <div key={field.key} className={`roster-duty ${value ? '' : 'is-open'}`.trim()}>
                  <dt>
                    <strong lang="sw">{field.label}</strong>
                    <small>
                      {field.en}
                      {field.time && (
                        <>
                          {' · '}
                          {day ? `${formatRosterDate(day, { weekday: true })} · ` : ''}
                          <span lang="sw">{field.time}</span> ({field.clock})
                        </>
                      )}
                    </small>
                  </dt>
                  <dd>{value || 'To be assigned'}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
