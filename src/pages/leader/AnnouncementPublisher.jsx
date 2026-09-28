import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import useRoleAnnouncements from '../../hooks/useRoleAnnouncements';
import AnnouncementPost from '../../components/AnnouncementPost';
import Alert from '../../components/Alert';
import { CheckIcon, MegaphoneIcon, SendIcon } from '../../components/Icons';
import { ANNOUNCEMENT_CATEGORIES, VISIBILITY_OPTIONS } from '../../data/constants';
import '../../styles/leader.css';

const TITLE_MAX = 120;
const CONTENT_MAX = 3000;

const INITIAL_FORM = {
  title: '',
  category: ANNOUNCEMENT_CATEGORIES[0],
  content: '',
  visibleTo: ['member', 'associate']
};

const getPublishError = (error) => {
  switch (error?.code) {
    case 'permission-denied':
      return 'Permission denied. Only approved leaders can publish announcements.';
    case 'unavailable':
      return 'Connection lost while publishing. Please check your internet and try again.';
    default:
      return 'The announcement could not be published. Please try again.';
  }
};

export default function AnnouncementPublisher() {
  const { currentUser, userProfile } = useAuth();
  const { announcements, status: feedStatus } = useRoleAnnouncements();
  const [form, setForm] = useState(INITIAL_FORM);
  const [publishing, setPublishing] = useState(false);
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
    if (publishing) return;

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

    setPublishing(true);
    setMessage({ type: 'info', text: 'Publishing announcement...' });

    try {
      // Keep audience tags in a stable order regardless of click order.
      const visibleTo = VISIBILITY_OPTIONS.map((opt) => opt.value).filter((tag) => form.visibleTo.includes(tag));

      await addDoc(collection(db, 'announcements'), {
        title,
        category: form.category,
        content,
        visibleTo,
        authorId: currentUser.uid,
        authorName: userProfile?.fullName || 'TUCASA Leadership',
        publishedAt: serverTimestamp()
      });

      setForm(INITIAL_FORM);
      setMessage({
        type: 'success',
        text: `"${title}" is now live for ${visibleTo.map((tag) => VISIBILITY_OPTIONS.find((o) => o.value === tag)?.label).join(', ')}.`
      });
    } catch (error) {
      console.error('Publish error:', error);
      setMessage({ type: 'error', text: getPublishError(error) });
    } finally {
      setPublishing(false);
    }
  };

  const preview = {
    title: form.title.trim() || 'Your announcement title',
    category: form.category,
    content: form.content.trim() || 'Your announcement content will appear here exactly as members will read it.',
    visibleTo: form.visibleTo,
    authorName: userProfile?.fullName || 'TUCASA Leadership',
    publishedAt: new Date()
  };

  const recent = announcements.slice(0, 5);

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>Publish Announcement</h2>
          <p>Create a post and choose exactly which audiences can see it.</p>
        </div>
      </div>

      <div className="publisher-grid">
        <section className="panel">
          <div className="panel-head">
            <h3><MegaphoneIcon width={18} height={18} /> New Announcement</h3>
          </div>

          {message.text && <Alert type={message.type}>{message.text}</Alert>}

          <form onSubmit={handleSubmit} className="publisher-form">
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

            <button type="submit" className="btn btn-primary btn-block" disabled={publishing}>
              {publishing ? (
                <>
                  <span className="spinner spinner-light" />
                  Publishing...
                </>
              ) : (
                <>
                  <SendIcon width={17} height={17} />
                  Publish Announcement
                </>
              )}
            </button>
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
            {feedStatus === 'loading' && (
              <div className="panel-loading">
                <span className="spinner" />
                <span>Loading...</span>
              </div>
            )}
            {feedStatus === 'error' && <Alert type="error">Recent posts could not be loaded.</Alert>}
            {feedStatus === 'ready' && recent.length === 0 && (
              <div className="empty-state">
                <MegaphoneIcon width={26} height={26} />
                <p>No announcements published yet.</p>
              </div>
            )}
            {feedStatus === 'ready' && recent.length > 0 && (
              <div className="post-stack">
                {recent.map((item) => (
                  <AnnouncementPost key={item.id} announcement={item} showAudience compact />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
