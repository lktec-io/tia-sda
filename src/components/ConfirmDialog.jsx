import { useEffect, useId, useRef } from 'react';
import { AlertIcon } from './Icons';

/**
 * Centered confirmation modal. Esc or the backdrop cancels (unless busy).
 * Focus starts on the safe "Cancel" action.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel
}) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onMouseDown={() => !busy && onCancel()}>
      <div
        className={`dialog ${danger ? 'dialog-danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className="dialog-icon"><AlertIcon width={26} height={26} /></span>
        <h2 id={titleId} className="dialog-title">{title}</h2>
        <p id={messageId} className="dialog-message">{message}</p>
        {detail && <div className="dialog-detail">{detail}</div>}
        <div className="dialog-actions">
          <button type="button" ref={cancelRef} className="btn btn-outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <span className="spinner spinner-light" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
