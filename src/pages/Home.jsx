import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  ArrowRightIcon,
  BookIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  HeartIcon,
  InstagramIcon,
  MusicIcon,
  ShopIcon,
  UsersIcon,
  YouTubeIcon
} from '../components/Icons';
import {
  HERO_SLIDE_INTERVAL_MS,
  album,
  choirChannels,
  heroSlides,
  fellowshipUpdates,
  sabbathGuidelines,
  sabbathSchedule,
  shopifyStoreUrl,
  welfarePrograms
} from '../data/siteContent';
import { formatDate, toDate } from '../utils/format';
import '../styles/home.css';

const MAX_ANNOUNCEMENTS = 6;
const EXCERPT_LENGTH = 160;

const truncate = (text = '', length = EXCERPT_LENGTH) =>
  text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;

const CHANNEL_ICONS = {
  instagram: InstagramIcon,
  youtube: YouTubeIcon
};

function AnnouncementCard({ announcement, expanded, onToggle }) {
  const content = announcement.content || '';
  const isLong = content.length > EXCERPT_LENGTH;
  const published = announcement.publishedAt || announcement.createdAt;
  const publishedDate = toDate(published);

  return (
    <article className="announcement-card">
      <div className="announcement-top">
        <span className="badge">{announcement.category || 'General'}</span>
        <time className="announcement-date" dateTime={publishedDate ? publishedDate.toISOString() : undefined}>
          <CalendarIcon width={16} height={16} />
          {formatDate(published)}
        </time>
      </div>
      <h3>{announcement.title || 'Untitled announcement'}</h3>
      <p>{expanded ? content : truncate(content)}</p>
      {isLong && (
        <button type="button" className="btn-link" onClick={onToggle} aria-expanded={expanded}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </article>
  );
}

function AnnouncementSkeleton() {
  return (
    <div className="announcement-card is-skeleton" aria-hidden="true">
      <div className="skeleton skeleton-badge" />
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line short" />
    </div>
  );
}

// Full-bleed background slideshow: stacked slides cross-fade via CSS opacity transitions.
function HeroSlideshow({ slides, interval }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    // Respect users who ask the OS for reduced motion: keep the first slide still.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const timer = setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, interval);
    return () => clearInterval(timer);
  }, [slides.length, interval]);

  return (
    <div className="hero-slides">
      {slides.map((src, index) => (
        <div
          key={src}
          className={`hero-slide ${index === active ? 'is-active' : ''}`}
          style={{ backgroundImage: `url('${src}')` }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const [announcements, setAnnouncements] = useState([]);
  const [feedStatus, setFeedStatus] = useState('loading'); // loading | ready | error
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let active = true;

    // Public feed: only announcements whose visibleTo array includes 'reader'.
    // Firestore is imported on demand so the hero renders without waiting for the SDK.
    import('../lib/publicFeed')
      .then(({ fetchPublicAnnouncements }) => fetchPublicAnnouncements(MAX_ANNOUNCEMENTS))
      .then((items) => {
        if (!active) return;
        setAnnouncements(items);
        setFeedStatus('ready');
      })
      .catch((error) => {
        console.error('Failed to load announcements:', error);
        if (active) setFeedStatus('error');
      });

    return () => {
      active = false;
    };
  }, []);

  const [videoFailed, setVideoFailed] = useState(false);
  const youtube = choirChannels.find((channel) => channel.platform === 'youtube');

  return (
    <div className="home">
      <Navbar />

      {/* ================= HERO ================= */}
      <section className="hero">
        <div className="hero-bg" aria-hidden="true">
          <HeroSlideshow slides={heroSlides} interval={HERO_SLIDE_INTERVAL_MS} />
          <span className="hero-overlay" />
          <span className="hero-glow hero-glow-gold" />
          <span className="hero-glow hero-glow-blue" />
          <span className="hero-ring" />
        </div>

        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="hero-kicker">
              <span className="hero-kicker-dot" />
              Seventh-day Adventist Student Church
            </span>
            <h1>
              TUCASA <span>TIA Mbeya</span>
            </h1>
            <p className="hero-lead">
              A home for worship, fellowship and service at the Tanzania Institute of Accountancy,
              Mbeya. Grow in faith, sing with purpose and serve alongside fellow students.
            </p>

            <div className="hero-cta">
              <Link to="/register" className="btn btn-gold">
                Join Fellowship
                <ArrowRightIcon width={18} height={18} />
              </Link>
              <Link to="/login" className="btn btn-glass">
                Member Access
              </Link>
            </div>

            <ul className="hero-pillars">
              <li><CheckIcon width={16} height={16} /> Worship</li>
              <li><CheckIcon width={16} height={16} /> Fellowship</li>
              <li><CheckIcon width={16} height={16} /> Service</li>
            </ul>
          </div>

          <aside className="hero-card" aria-label="Sabbath at a glance">
            <div className="hero-card-head">
              <span className="hero-card-icon"><ClockIcon width={18} height={18} /></span>
              <div>
                <strong>Sabbath at a glance</strong>
                <span>Every week on campus</span>
              </div>
            </div>
            <ul className="hero-schedule">
              {sabbathSchedule.map((item) => (
                <li key={item.title}>
                  <span className="hero-schedule-time">{item.time}</span>
                  <span className="hero-schedule-title">{item.title}</span>
                </li>
              ))}
            </ul>
            <a href="#ministries" className="hero-card-link">
              Service guidelines <ArrowRightIcon width={16} height={16} />
            </a>
          </aside>
        </div>
      </section>

      {/* ================= ANNOUNCEMENTS ================= */}
      <section className="section" id="announcements">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Latest News</span>
            <h2 className="section-title">Public Announcements</h2>
            <p className="section-lead">
              Stay up to date with services, events and programs from the TUCASA TIA Mbeya family.
            </p>
          </div>

          {feedStatus === 'loading' && (
            <div className="announcement-grid" role="status" aria-label="Loading announcements">
              {Array.from({ length: 3 }, (_, i) => <AnnouncementSkeleton key={i} />)}
            </div>
          )}

          {feedStatus === 'error' && (
            <div className="feed-state">
              <p>We couldn't load announcements right now. Please check your connection and refresh the page.</p>
            </div>
          )}

          {feedStatus === 'ready' && announcements.length === 0 && (
            <div className="feed-state">
              <CalendarIcon width={28} height={28} />
              <p>No public announcements yet. Check back soon for upcoming programs.</p>
            </div>
          )}

          {feedStatus === 'ready' && announcements.length > 0 && (
            <div className="announcement-grid">
              {announcements.map((item) => (
                <AnnouncementCard
                  key={item.id}
                  announcement={item}
                  expanded={expandedId === item.id}
                  onToggle={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ================= CHOIR & MINISTRIES ================= */}
      <section className="section section-tint" id="ministries">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Choir & Campus Ministries</span>
            <h2 className="section-title">Serving Through Song and Fellowship</h2>
            <p className="section-lead">
              From the choir loft to the hostel Bible study, there is a place for every student to serve.
            </p>
          </div>

          <div className="album-showcase">
            <div className="album-video">
              {videoFailed ? (
                <div className="album-video-fallback" role="status">
                  <MusicIcon width={32} height={32} />
                  <p>The “{album.title}” video is unavailable right now.</p>
                  {youtube && (
                    <a href={youtube.url} target="_blank" rel="noopener noreferrer" className="btn btn-gold btn-sm">
                      <YouTubeIcon width={17} height={17} />
                      Watch on YouTube
                    </a>
                  )}
                </div>
              ) : (
                <video
                  src={album.videoSrc}
                  loop
                  muted
                  playsInline
                  autoPlay
                  preload="auto"
                  aria-label={`${album.artist} — ${album.title} (${album.year})`}
                  onError={() => setVideoFailed(true)}
                >
                  Your browser does not support HTML5 video.
                </video>
              )}
            </div>

            <div className="album-info">
              <span className="badge badge-gold">
                <MusicIcon width={14} height={14} />
                {album.tagline}
              </span>
              <h3>“{album.title}”</h3>
              <p className="album-artist">{album.artist}</p>

              <div className="album-actions">
                {choirChannels.map((channel) => {
                  const Icon = CHANNEL_ICONS[channel.platform];
                  return (
                    <a
                      key={channel.id}
                      href={channel.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`btn btn-sm ${channel.platform === 'youtube' ? 'btn-gold' : 'btn-glass'}`}
                    >
                      {Icon && <Icon width={17} height={17} />}
                      {channel.platform === 'youtube' ? 'Watch on YouTube' : 'Follow on Instagram'}
                    </a>
                  );
                })}
                {shopifyStoreUrl && (
                  <a href={shopifyStoreUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-glass">
                    <ShopIcon width={17} height={17} />
                    Buy the Album
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="ministry-grid">
            <article className="ministry-card">
              <div className="ministry-icon"><BookIcon /></div>
              <h3>Sabbath Service Guidelines</h3>
              <ul className="ministry-schedule">
                {sabbathSchedule.map((item) => (
                  <li key={item.title}>
                    <span>{item.time}</span>
                    <strong>{item.title}</strong>
                  </li>
                ))}
              </ul>
              <ul className="ministry-list ministry-list-check">
                {sabbathGuidelines.map((rule) => (
                  <li key={rule}><CheckIcon width={16} height={16} /> {rule}</li>
                ))}
              </ul>
            </article>

            <article className="ministry-card">
              <div className="ministry-icon"><UsersIcon /></div>
              <h3>Student Fellowship Updates</h3>
              <ul className="ministry-list">
                {fellowshipUpdates.map((item) => (
                  <li key={item.title}>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="ministry-card">
              <div className="ministry-icon"><HeartIcon /></div>
              <h3>Welfare Programs</h3>
              <ul className="ministry-list">
                {welfarePrograms.map((item) => (
                  <li key={item.title}>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* ================= JOIN BAND ================= */}
      <section className="join-band">
        <div className="container join-band-inner">
          <div>
            <h2>Become part of the TUCASA family</h2>
            <p>Register as a reader, member or associate and stay connected with everything happening on campus.</p>
          </div>
          <div className="join-band-actions">
            <Link to="/register" className="btn btn-gold">
              Join Fellowship <ArrowRightIcon width={18} height={18} />
            </Link>
            <Link to="/login" className="btn btn-glass">Member Access</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
