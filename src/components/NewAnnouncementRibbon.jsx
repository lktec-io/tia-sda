/**
 * Flashing crimson ribbon shown at the top of an announcement feed whenever a post
 * went live within the last 48 hours. The glow pulses via `@keyframes crimsonPulse`
 * (slow, ~1.6 s cycle — well below seizure-risk flash rates) and stops for users
 * who prefer reduced motion.
 */
export default function NewAnnouncementRibbon({ count }) {
  return (
    <div className="new-ribbon" role="status">
      <span className="new-ribbon-dot" aria-hidden="true" />
      <span className="new-ribbon-text">
        NEW ANNOUNCEMENT LIVE <span aria-hidden="true">•</span> <span lang="sw">TAARIFA MPYA YA KANISA</span>
      </span>
      {count > 1 && <span className="new-ribbon-count">{count} new</span>}
    </div>
  );
}
