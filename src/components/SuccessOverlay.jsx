import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Full-screen success confirmation: an animated, pulsing tick, a message and a
 * countdown bar. Calls `onDone` after `duration` ms (used to redirect).
 */
export default function SuccessOverlay({ title, sw, message, duration = 2500, onDone, doneLabel = 'Redirecting…' }) {
  // Latest callback without restarting the timer when the parent re-renders.
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timer = setTimeout(() => doneRef.current?.(), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  return createPortal(
    <div className="success-overlay" role="alertdialog" aria-modal="true" aria-labelledby="success-title" aria-describedby="success-message">
      <div className="success-card" style={{ '--success-ms': `${duration}ms` }}>
        <span className="success-tick" aria-hidden="true">
          <svg viewBox="0 0 108 108">
            <circle className="success-tick-circle" cx="54" cy="54" r="48" />
            <path className="success-tick-check" d="M33 55l14 14 28-30" />
          </svg>
        </span>
        <h2 id="success-title">{title}</h2>
        {sw && (
          <span className="success-sw" lang="sw">
            {sw}
          </span>
        )}
        <p id="success-message">{message}</p>
        <div className="success-progress" aria-hidden="true">
          <span />
        </div>
        <small role="status">{doneLabel}</small>
      </div>
    </div>,
    document.body
  );
}
