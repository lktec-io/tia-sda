import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addDoc, collection, deleteField, doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import useRoleAnnouncements from '../../hooks/useRoleAnnouncements';
import useAnnouncementDeletion from '../../hooks/useAnnouncementDeletion';
import AnnouncementPost from '../../components/AnnouncementPost';
import Alert from '../../components/Alert';
import PosterUpload from '../../components/PosterUpload';
import PublicAnnouncementCard from '../../components/PublicAnnouncementCard';
import SuccessOverlay from '../../components/SuccessOverlay';
import { CalendarIcon, CheckIcon, ClockIcon, FileIcon, MegaphoneIcon, SendIcon, TrashIcon, UserIcon } from '../../components/Icons';
import { ANNOUNCEMENT_CATEGORIES, DEFAULT_ISSUER, ISSUING_AUTHORITIES, VISIBILITY_OPTIONS } from '../../data/constants';
import { formatDateTime, formatLongDate, toDate } from '../../utils/format';
import '../../styles/leader.css';

const TITLE_MAX = 120;
const CONTENT_MAX = 3000;
// After a successful save the success overlay shows for this long, then the leader
// is taken to the announcements list.
const SUCCESS_REDIRECT_MS = 2500;
const SUCCESS_REDIRECT_TO = '/dashboard/announcements';

const EMPTY_FORM = {
  title: '',
  category: ANNOUNCEMENT_CATEGORIES[0],
  content: '',
  visibleTo: ['member', 'associate'],
  imageUrl: '',
  issuedBy: DEFAULT_ISSUER, // "Source Authority" — office that issued the post
  eventDate: '', // "YYYY-MM-DD", '' = no event date
  scheduledAt: '', // datetime-local string, '' = publish immediately
  expiresAt: '' // datetime-local string, '' = never expires
};

// Firestore Timestamp / Date -> "YYYY-MM-DDTHH:mm" in the leader's local time zone
// (the format <input type="datetime-local"> expects).
const toLocalInput = (value) => {
  const date = toDate(value);
  if (!date) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// "YYYY-MM-DDTHH:mm" (local) -> Date, or null when empty/invalid.
const fromLocalInput = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Event day: Timestamp/Date <-> "YYYY-MM-DD" (<input type="date">). Stored at local
// noon so time-zone shifts can never move it to a neighbouring day.
const toDateInput = (value) => toLocalInput(value).slice(0, 10);

const fromDateInput = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return date.getDate() === Number(match[3]) ? date : null;
};

// Pre-populates the form from an existing announcement (Edit Mode).
const formFrom = (announcement) =>
  announcement
    ? {
        title: announcement.title || '',
        category: ANNOUNCEMENT_CATEGORIES.includes(announcement.category) ? announcement.category : 'General',
        content: announcement.content || '',
        visibleTo: Array.isArray(announcement.visibleTo) ? announcement.visibleTo : [],
        imageUrl: announcement.imageUrl || '',
        issuedBy: ISSUING_AUTHORITIES.includes(announcement.issuedBy) ? announcement.issuedBy : DEFAULT_ISSUER,
        eventDate: toDateInput(announcement.eventDate),
        scheduledAt: toLocalInput(announcement.scheduledAt),
        expiresAt: toLocalInput(announcement.expiresAt)
      }
    : EMPTY_FORM;

const getSaveError = (error, isEdit) => {
  switch (error?.code) {
    case 'permission-denied':
      return 'Permission denied. Only leaders can publish or edit announcements (check that the latest firestore.rules are deployed).';
    case 'not-found':
      return 'This announcement no longer exists.';
    case 'unavailable':
      return 'Connection lost while saving. Please check your internet and try again.';
    default:
      return isEdit ? 'The announcement could not be updated. Please try again.' : 'The announcement could not be published. Please try again.';
  }
};

const audienceLabels = (tags) =>
  tags.map((tag) => VISIBILITY_OPTIONS.find((o) => o.value === tag)?.label).filter(Boolean).join(', ');

/**
 * Dual-purpose announcement editor.
 * - Create Mode: /leader/publish
 * - Edit Mode:   /leader/publish/:announcementId, or pass an `announcement` prop.
 */
export default function AnnouncementPublisher({ announcement: passedAnnouncement = null }) {
  const { announcementId } = useParams();
  const feed = useRoleAnnouncements();

  const editing =
    passedAnnouncement ??
    (announcementId ? feed.announcements.find((item) => item.id === announcementId) ?? null : null);

  // Resolving an edit link that is still loading / points at a deleted post.
  if (announcementId && !passedAnnouncement && !editing) {
    return (
      <div className="view">
        <div className="view-head">
          <div>
            <h2>Edit Announcement</h2>
            <p>Update the content, poster and audience of a published announcement.</p>
          </div>
        </div>
        {feed.status === 'loading' ? (
          <div className="panel panel-loading">
            <span className="spinner" />
            <span>Loading announcement...</span>
          </div>
        ) : (
          <Alert type="error">
            {feed.status === 'error'
              ? 'Announcements could not be loaded. Please try again.'
              : 'This announcement could not be found. It may have been deleted.'}{' '}
            <Link to="/leader/publish" className="btn-link">Create a new announcement</Link>
          </Alert>
        )}
      </div>
    );
  }

  // Keyed by announcement id so switching between posts re-initialises the form cleanly.
  return <PublisherWorkspace key={editing?.id ?? 'new'} editing={editing} feed={feed} />;
}

function PublisherWorkspace({ editing, feed }) {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const isEdit = Boolean(editing);

  const [form, setForm] = useState(() => formFrom(editing));
  const [saving, setSaving] = useState(false);
  const [posterBusy, setPosterBusy] = useState(false);
  const [posterPreview, setPosterPreview] = useState(''); // local blob while uploading
  const [message, setMessage] = useState({ type: '', text: '' });
  const [success, setSuccess] = useState(null); // { title, message } → full-screen overlay
  // Delete from the "Recently Published" list (not offered for the post being edited).
  const { requestDelete, dialog: deleteDialog, notice: deleteNotice } = useAnnouncementDeletion();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleAudience = (value) => {
    setForm((prev) => ({
      ...prev,
      visibleTo: prev.visibleTo.includes(value)
        ? prev.visibleTo.filter((tag) => tag !== value)
        : [...prev.visibleTo, value]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (posterBusy) {
      setMessage({ type: 'info', text: 'Please wait for the poster to finish uploading.' });
      return;
    }

    const title = form.title.trim();
    const content = form.content.trim();

    if (!title || !content) {
      setMessage({ type: 'error', text: 'Please provide both a title and the announcement content.' });
      return;
    }
    if (form.visibleTo.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one audience who can see this announcement.' });
      return;
    }

    const scheduledDate = fromLocalInput(form.scheduledAt);
    const expiresDate = fromLocalInput(form.expiresAt);
    const nowMs = Date.now();
    const expiryChanged = form.expiresAt !== formFrom(editing).expiresAt;

    if (form.scheduledAt && !scheduledDate) {
      setMessage({ type: 'error', text: 'The publish schedule time is not a valid date.' });
      return;
    }
    if (form.expiresAt && !expiresDate) {
      setMessage({ type: 'error', text: 'The expiry date is not a valid date.' });
      return;
    }
    if (expiresDate && scheduledDate && expiresDate <= scheduledDate) {
      setMessage({ type: 'error', text: 'The expiry date must be later than the publish schedule time.' });
      return;
    }
    // An unchanged past expiry is allowed on edit so leaders can still fix an archived post.
    if (expiresDate && expiryChanged && expiresDate.getTime() <= nowMs) {
      setMessage({ type: 'error', text: 'The expiry date must be in the future.' });
      return;
    }
    const eventDay = fromDateInput(form.eventDate);
    if (form.eventDate && !eventDay) {
      setMessage({ type: 'error', text: 'The event date (Tarehe ya Tukio) is not a valid date.' });
      return;
    }
    if (!ISSUING_AUTHORITIES.includes(form.issuedBy)) {
      setMessage({ type: 'error', text: 'Choose which office is issuing this announcement.' });
      return;
    }

    setSaving(true);
    setMessage({ type: 'info', text: isEdit ? 'Saving changes...' : 'Publishing announcement...' });

    // Keep audience tags in a stable order regardless of click order.
    const visibleTo = VISIBILITY_OPTIONS.map((opt) => opt.value).filter((tag) => form.visibleTo.includes(tag));
    const fields = {
      title,
      category: form.category,
      content,
      visibleTo,
      imageUrl: form.imageUrl,
      issuedBy: form.issuedBy
    };
    const scheduledTs = scheduledDate ? Timestamp.fromDate(scheduledDate) : null;
    const expiresTs = expiresDate ? Timestamp.fromDate(expiresDate) : null;
    const eventTs = eventDay ? Timestamp.fromDate(eventDay) : null;

    const isFuture = scheduledDate && scheduledDate.getTime() > nowMs;
    const audience = audienceLabels(visibleTo);
    const liveText = isFuture
      ? `is scheduled to go live for ${audience} on ${formatDateTime(scheduledDate)}`
      : `is live for ${audience}`;
    const expiryText = expiresDate ? ` It will be hidden automatically after ${formatDateTime(expiresDate)}.` : '';

    try {
      if (isEdit) {
        await updateDoc(doc(db, 'announcements', editing.id), {
          ...fields,
          // Cleared fields are removed so the post publishes immediately / never expires.
          scheduledAt: scheduledTs ?? deleteField(),
          expiresAt: expiresTs ?? deleteField(),
          eventDate: eventTs ?? deleteField(),
          updatedBy: currentUser.uid,
          updatedAt: serverTimestamp()
        });
        setMessage({ type: '', text: '' });
        setSuccess({ title: 'Announcement Updated', message: `"${title}" has been updated and ${liveText}.${expiryText}` });
      } else {
        await addDoc(collection(db, 'announcements'), {
          ...fields,
          ...(scheduledTs && { scheduledAt: scheduledTs }),
          ...(expiresTs && { expiresAt: expiresTs }),
          ...(eventTs && { eventDate: eventTs }),
          authorId: currentUser.uid,
          authorName: userProfile?.fullName || 'TUCASA Leadership',
          publishedAt: serverTimestamp()
        });
        setForm(EMPTY_FORM);
        setMessage({ type: '', text: '' });
        setSuccess({ title: 'Announcement Published', message: `"${title}" ${liveText}.${expiryText}` });
      }
    } catch (error) {
      console.error(isEdit ? 'Announcement update error:' : 'Publish error:', error);
      setMessage({ type: 'error', text: getSaveError(error, isEdit) });
    } finally {
      setSaving(false);
    }
  };

  const preview = {
    title: form.title.trim() || 'Your announcement title',
    category: form.category,
    content: form.content.trim() || 'Your announcement content will appear here exactly as members will read it.',
    visibleTo: form.visibleTo,
    imageUrl: form.imageUrl,
    issuedBy: form.issuedBy,
    eventDate: fromDateInput(form.eventDate),
    authorName: editing?.authorName || userProfile?.fullName || 'TUCASA Leadership',
    publishedAt: editing?.publishedAt || new Date(),
    scheduledAt: fromLocalInput(form.scheduledAt),
    expiresAt: fromLocalInput(form.expiresAt)
  };

  const recent = feed.announcements.slice(0, 5);

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>{isEdit ? 'Edit Announcement' : 'Publish Announcement'}</h2>
          <p>
            {isEdit
              ? 'Update the content, poster and audience. Changes go live immediately.'
              : 'Create a post, add an event poster and choose exactly which audiences can see it.'}
          </p>
        </div>
        {isEdit && (
          <Link to="/leader/publish" className="btn btn-outline btn-sm">
            <MegaphoneIcon width={16} height={16} />
            New Announcement
          </Link>
        )}
      </div>

      <div className="publisher-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>
              {isEdit ? <FileIcon width={18} height={18} /> : <MegaphoneIcon width={18} height={18} />}
              {isEdit ? 'Editing Announcement' : 'New Announcement'}
            </h3>
            {isEdit && <span className="badge badge-gold">Edit Mode</span>}
          </div>

          {message.text && <Alert type={message.type}>{message.text}</Alert>}
          {deleteNotice.text && <Alert type={deleteNotice.type}>{deleteNotice.text}</Alert>}

          <form onSubmit={handleSubmit} className="publisher-form">
            <PosterUpload
              value={form.imageUrl}
              onChange={(url) => setForm((prev) => ({ ...prev, imageUrl: url }))}
              onBusyChange={setPosterBusy}
              onPreviewChange={setPosterPreview}
              disabled={saving}
            />

            <div className="field">
              <label htmlFor="post-title">Title</label>
              <input
                id="post-title"
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                maxLength={TITLE_MAX}
                placeholder="e.g. Combined Sabbath Service this weekend"
                required
              />
            </div>

            <div className="publisher-row">
              <div className="field">
                <label htmlFor="post-category">Category</label>
                <select id="post-category" name="category" value={form.category} onChange={handleChange}>
                  {ANNOUNCEMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="post-issuer">
                  <span>
                    <UserIcon width={14} height={14} /> Source Authority{' '}
                    <span className="label-sw" lang="sw">/ Imetolewa na</span>
                  </span>
                </label>
                <select id="post-issuer" name="issuedBy" value={form.issuedBy} onChange={handleChange}>
                  {ISSUING_AUTHORITIES.map((office) => (
                    <option key={office} value={office}>{office}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="post-event-date">
                <span>
                  <CalendarIcon width={14} height={14} /> Event Date{' '}
                  <span className="label-sw" lang="sw">/ Tarehe ya Tukio</span>
                </span>
                <span className="char-count">Optional</span>
              </label>
              <div className="publisher-inline">
                <input id="post-event-date" type="date" name="eventDate" value={form.eventDate} onChange={handleChange} />
                {form.eventDate && (
                  <button type="button" className="btn-link" onClick={() => setForm((p) => ({ ...p, eventDate: '' }))}>
                    Clear
                  </button>
                )}
              </div>
              {form.eventDate && fromDateInput(form.eventDate) && (
                <small className="field-hint">Shown on the post as “Tarehe ya Tukio: {formatLongDate(fromDateInput(form.eventDate))}”.</small>
              )}
            </div>

            <div className="field">
              <label htmlFor="post-content">
                Content
                <span className="char-count">{form.content.length}/{CONTENT_MAX}</span>
              </label>
              <textarea
                id="post-content"
                name="content"
                value={form.content}
                onChange={handleChange}
                maxLength={CONTENT_MAX}
                rows={8}
                placeholder="Write the full announcement. Line breaks are preserved."
                required
              />
            </div>

            <fieldset className="schedule-set">
              <legend>
                <ClockIcon width={16} height={16} />
                Scheduling
              </legend>
              <div className="schedule-grid">
                <div className="field">
                  <label htmlFor="post-scheduled">
                    <span>
                      Publish Schedule Time <span className="label-sw" lang="sw">/ Muda wa Kurusha</span>
                    </span>
                  </label>
                  <input
                    id="post-scheduled"
                    type="datetime-local"
                    name="scheduledAt"
                    value={form.scheduledAt}
                    onChange={handleChange}
                    aria-describedby="schedule-hint"
                  />
                  {form.scheduledAt && (
                    <button type="button" className="btn-link schedule-clear" onClick={() => setForm((p) => ({ ...p, scheduledAt: '' }))}>
                      Publish immediately instead
                    </button>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="post-expires">
                    <span>
                      Announcement Expiry Date <span className="label-sw" lang="sw">/ Tarehe ya Kuondoa</span>
                    </span>
                  </label>
                  <input
                    id="post-expires"
                    type="datetime-local"
                    name="expiresAt"
                    value={form.expiresAt}
                    min={form.scheduledAt || undefined}
                    onChange={handleChange}
                    aria-describedby="schedule-hint"
                  />
                  {form.expiresAt && (
                    <button type="button" className="btn-link schedule-clear" onClick={() => setForm((p) => ({ ...p, expiresAt: '' }))}>
                      Never expire
                    </button>
                  )}
                </div>
              </div>
              <p id="schedule-hint" className="schedule-hint">
                Leave both empty to publish now with no expiry. Scheduled posts stay hidden from members until their
                time; expired posts are hidden automatically. Times use your device&apos;s time zone.
              </p>
            </fieldset>

            <fieldset className="audience-set">
              <legend>Visibility</legend>
              <div className="audience-options">
                {VISIBILITY_OPTIONS.map((opt) => {
                  const checked = form.visibleTo.includes(opt.value);
                  return (
                    <label key={opt.value} className={`audience-option ${checked ? 'is-checked' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleAudience(opt.value)} />
                      <span className="audience-check" aria-hidden="true">
                        <CheckIcon width={14} height={14} />
                      </span>
                      <span className="audience-text">
                        <strong>{opt.label}</strong>
                        <small>{opt.hint}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
              {form.visibleTo.includes('reader') && (
                <p className="audience-note">Readers include the public website — this post will be visible to anyone.</p>
              )}
            </fieldset>

            <div className="publisher-submit">
              {isEdit && (
                <button type="button" className="btn btn-outline" onClick={() => navigate('/leader')} disabled={saving}>
                  Cancel
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={saving || posterBusy}>
                {saving ? (
                  <>
                    <span className="spinner spinner-light" />
                    {isEdit ? 'Saving...' : 'Publishing...'}
                  </>
                ) : posterBusy ? (
                  'Uploading poster...'
                ) : (
                  <>
                    {isEdit ? <CheckIcon width={17} height={17} /> : <SendIcon width={17} height={17} />}
                    {isEdit ? 'Save Changes' : 'Publish Announcement'}
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <div className="publisher-side">
          <section className="panel">
            <div className="panel-head">
              <h3>Live Preview</h3>
              {form.visibleTo.includes('reader') && <span className="badge badge-gold">Public</span>}
            </div>

            {/* Exact homepage card (same component + 16:9 poster canvas). */}
            <div className="announcement-stage">
              <span className="announcement-stage-label">
                {form.visibleTo.includes('reader') ? 'Homepage card' : 'Homepage card (shown only if Readers is ticked)'}
              </span>
              <PublicAnnouncementCard
                announcement={{ ...preview, imageUrl: posterPreview || preview.imageUrl, isNew: !isEdit }}
              />
            </div>

            <span className="preview-subhead">Member feed</span>
            <AnnouncementPost announcement={preview} showAudience />
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Recently Published</h3>
            </div>
            {feed.status === 'loading' && (
              <div className="panel-loading">
                <span className="spinner" />
                <span>Loading...</span>
              </div>
            )}
            {feed.status === 'error' && (
              <Alert type="error">
                Recent posts could not be loaded.{' '}
                <button type="button" className="btn-link" onClick={feed.retry}>Retry</button>
              </Alert>
            )}
            {feed.status === 'ready' && recent.length === 0 && (
              <div className="empty-state">
                <MegaphoneIcon width={26} height={26} />
                <p>No announcements published yet.</p>
              </div>
            )}
            {feed.status === 'ready' && recent.length > 0 && (
              <div className="post-stack">
                {recent.map((item) => (
                  <AnnouncementPost
                    key={item.id}
                    announcement={item}
                    showAudience
                    compact
                    showSchedule
                    now={feed.now}
                    actions={
                      <>
                        {editing?.id === item.id ? (
                          <span className="badge badge-gold">Editing</span>
                        ) : (
                          <Link to={`/leader/publish/${item.id}`} className="btn btn-outline btn-sm">
                            <FileIcon width={15} height={15} />
                            <span>Edit</span>
                          </Link>
                        )}
                        {editing?.id !== item.id && (
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          onClick={() => requestDelete(item)}
                          aria-label={`Delete announcement: ${item.title || 'untitled'}`}
                          title="Delete announcement"
                        >
                          <TrashIcon width={16} height={16} />
                        </button>
                        )}
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {deleteDialog}

      {success && (
        <SuccessOverlay
          title={success.title}
          sw="Taarifa Imetumwa kwa Mafanikio"
          message={success.message}
          duration={SUCCESS_REDIRECT_MS}
          doneLabel="Taking you to the announcements list…"
          onDone={() => navigate(SUCCESS_REDIRECT_TO)}
        />
      )}
    </div>
  );
}
