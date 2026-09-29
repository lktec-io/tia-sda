import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import useRoleAnnouncements from '../../hooks/useRoleAnnouncements';
import AnnouncementPost from '../../components/AnnouncementPost';
import Alert from '../../components/Alert';
import PosterUpload from '../../components/PosterUpload';
import { CheckIcon, FileIcon, MegaphoneIcon, SendIcon } from '../../components/Icons';
import { ANNOUNCEMENT_CATEGORIES, VISIBILITY_OPTIONS } from '../../data/constants';
import '../../styles/leader.css';

const TITLE_MAX = 120;
const CONTENT_MAX = 3000;

const EMPTY_FORM = {
  title: '',
  category: ANNOUNCEMENT_CATEGORIES[0],
  content: '',
  visibleTo: ['member', 'associate'],
  imageUrl: ''
};

// Pre-populates the form from an existing announcement (Edit Mode).
const formFrom = (announcement) =>
  announcement
    ? {
        title: announcement.title || '',
        category: ANNOUNCEMENT_CATEGORIES.includes(announcement.category) ? announcement.category : 'General',
        content: announcement.content || '',
        visibleTo: Array.isArray(announcement.visibleTo) ? announcement.visibleTo : [],
        imageUrl: announcement.imageUrl || ''
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
  const [message, setMessage] = useState({ type: '', text: '' });

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

    setSaving(true);
    setMessage({ type: 'info', text: isEdit ? 'Saving changes...' : 'Publishing announcement...' });

    // Keep audience tags in a stable order regardless of click order.
    const visibleTo = VISIBILITY_OPTIONS.map((opt) => opt.value).filter((tag) => form.visibleTo.includes(tag));
    const fields = {
      title,
      category: form.category,
      content,
      visibleTo,
      imageUrl: form.imageUrl
    };

    try {
      if (isEdit) {
        await updateDoc(doc(db, 'announcements', editing.id), {
          ...fields,
          updatedBy: currentUser.uid,
          updatedAt: serverTimestamp()
        });
        setMessage({ type: 'success', text: `"${title}" has been updated and is live for ${audienceLabels(visibleTo)}.` });
      } else {
        await addDoc(collection(db, 'announcements'), {
          ...fields,
          authorId: currentUser.uid,
          authorName: userProfile?.fullName || 'TUCASA Leadership',
          publishedAt: serverTimestamp()
        });
        setForm(EMPTY_FORM);
        setMessage({ type: 'success', text: `"${title}" is now live for ${audienceLabels(visibleTo)}.` });
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
    authorName: editing?.authorName || userProfile?.fullName || 'TUCASA Leadership',
    publishedAt: editing?.publishedAt || new Date()
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

          <form onSubmit={handleSubmit} className="publisher-form">
            <PosterUpload
              value={form.imageUrl}
              onChange={(url) => setForm((prev) => ({ ...prev, imageUrl: url }))}
              onBusyChange={setPosterBusy}
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

            <div className="field">
              <label htmlFor="post-category">Category</label>
              <select id="post-category" name="category" value={form.category} onChange={handleChange}>
                {ANNOUNCEMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
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
            </div>
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
                    actions={
                      editing?.id === item.id ? (
                        <span className="badge badge-gold">Editing</span>
                      ) : (
                        <Link to={`/leader/publish/${item.id}`} className="btn btn-outline btn-sm">
                          <FileIcon width={15} height={15} />
                          Edit Poster/Post
                        </Link>
                      )
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
