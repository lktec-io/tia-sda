import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertIcon, TrashIcon } from './Icons';

/**
 * Centered confirmation modal for destructive (and other) actions.
 * Frosted-glass backdrop, warning icon, crimson confirm button and a quiet
 * link-style cancel. Esc or a backdrop click cancels (unless busy); focus starts on
 * the safe "Cancel" action and is trapped between the two buttons. Rendered in a
 * portal on <body> so no parent overflow/transform can clip it.
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
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    cancelRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation();
        onCancel();
      }
      // Keep Tab cycling inside the dialog.
      if (e.key === 'Tab') {
        const order = [cancelRef.current, confirmRef.current].filter((el) => el && !el.disabled);
        if (order.length === 0) return;
        const index = order.indexOf(document.activeElement);
        const nextIndex = e.shiftKey ? (index <= 0 ? order.length - 1 : index - 1) : (index + 1) % order.length;
        e.preventDefault();
        order[nextIndex].focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={() => !busy && onCancel()}>
      <div
        className={`dialog ${danger ? 'dialog-danger' : ''}`.trim()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className="dialog-icon" aria-hidden="true">
          <span className="dialog-icon-ring" />
          {danger ? <TrashIcon width={26} height={26} /> : <AlertIcon width={26} height={26} />}
        </span>
        {danger && (
          <span className="dialog-warning">
            <AlertIcon width={13} height={13} />
            Irreversible action
          </span>
        )}
        <h2 id={titleId} className="dialog-title">{title}</h2>
        <p id={messageId} className="dialog-message">{message}</p>
        {detail && <div className="dialog-detail">{detail}</div>}
        <div className="dialog-actions">
          <button
            type="button"
            ref={confirmRef}
            className={`btn ${danger ? 'btn-crimson' : 'btn-primary'} dialog-confirm`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <span className="spinner spinner-light" />}
            {confirmLabel}
          </button>
          <button type="button" ref={cancelRef} className="dialog-cancel" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
