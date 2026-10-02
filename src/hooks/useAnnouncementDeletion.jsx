import { useCallback, useState } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDate } from '../utils/format';
import { effectiveDate } from '../utils/announcements';

const deleteError = (error) =>
  error?.code === 'permission-denied'
    ? 'Permission denied. Only leaders can delete announcements (check that the latest firestore.rules are deployed).'
    : 'The announcement could not be deleted. Please try again.';

/**
 * Leader delete pipeline for announcements: `requestDelete(item)` opens the frosted
 * confirmation dialog; confirming runs deleteDoc on announcements/{id}. Live feeds
 * drop the post automatically through their onSnapshot listeners.
 *
 * Render `dialog` once in the page. `notice` reports the outcome ({ type, text }).
 */
export default function useAnnouncementDeletion({ onDeleted } = {}) {
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  const requestDelete = useCallback((announcement) => {
    setNotice({ type: '', text: '' });
    setTarget(announcement);
  }, []);

  const cancel = useCallback(() => setTarget(null), []);

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'announcements', target.id));
      setNotice({ type: 'success', text: `"${target.title || 'Untitled announcement'}" has been deleted.` });
      onDeleted?.(target);
      setTarget(null);
    } catch (error) {
      console.error('Announcement delete error:', error);
      setNotice({ type: 'error', text: deleteError(error) });
      setTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const dialog = (
    <ConfirmDialog
      open={Boolean(target)}
      danger
      busy={busy}
      title="Delete this announcement?"
      message="It will disappear immediately from the public website and every member feed."
      detail={
        target && (
          <>
            <strong>{target.title || 'Untitled announcement'}</strong>
            <span>
              {target.category || 'General'} · {formatDate(effectiveDate(target))}
            </span>
            <small>This permanently deletes the post and cannot be undone.</small>
          </>
        )
      }
      confirmLabel={busy ? 'Deleting…' : 'Yes, delete announcement'}
      cancelLabel="No, keep it"
      onConfirm={confirm}
      onCancel={cancel}
    />
  );

  return { requestDelete, dialog, notice, clearNotice: () => setNotice({ type: '', text: '' }) };
}
