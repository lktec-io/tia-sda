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
  latestUpdateLabel,
  sabbathGuidelines,
  sabbathSchedule,
  shopifyStoreUrl,
  swahiliLabels,
  welfarePrograms
} from '../data/siteContent';
import { formatDate, toDate } from '../utils/format';
import { cloudinaryBanner } from '../lib/cloudinary';
import '../styles/home.css';

const MAX_ANNOUNCEMENTS = 6;
const EXCERPT_LENGTH = 160;
const NEW_POST_WINDOW_MS = 48 * 60 * 60 * 1000; // "Latest update" badge for posts < 48 h old

const truncate = (text = '', length = EXCERPT_LENGTH) =>
  text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;

const CHANNEL_ICONS = {
  instagram: InstagramIcon,
  youtube: YouTubeIcon
};

// Swahili sub-label rendered in soft italics beneath an English heading.
function Sw({ children, className = '' }) {
  return (
    <span className={`sw-label ${className}`.trim()} lang="sw">
      {children}
    </span>
  );
}

// Poster canvas: the leader-uploaded event poster, or a deep gradient fallback.
function PosterCanvas({ imageUrl, category }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const showImage = imageUrl && failedUrl !== imageUrl;

  return (
    <div className={`announcement-poster ${showImage ? 'has-image' : ''}`}>
      {showImage ? (
        <img
          src={cloudinaryBanner(imageUrl, 800)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <span className="announcement-poster-fallback" aria-hidden="true">
          <CalendarIcon width={30} height={30} />
          <span>{category}</span>
        </span>
      )}
    </div>
  );
}

function AnnouncementCard({ announcement, expanded, onToggle }) {
  const content = announcement.content || '';
  const isLong = content.length > EXCERPT_LENGTH;
  const published = announcement.publishedAt || announcement.createdAt;
  const publishedDate = toDate(published);
  const category = announcement.category || 'General';

  return (
    <article className={`announcement-card ${announcement.isNew ? 'is-new' : ''}`.trim()}>
      {announcement.isNew && (
        <span className="new-chip">
          <span className="pulse-dot" aria-hidden="true" />
          {latestUpdateLabel}
        </span>
      )}
      <PosterCanvas imageUrl={announcement.imageUrl} category={category} />
      <div className="announcement-body">
        <div className="announcement-top">
          <span className="badge">{category}</span>
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
      </div>
    </article>
  );
}

function AnnouncementSkeleton() {
  return (
    <div className="announcement-card is-skeleton" aria-hidden="true">
      <div className="announcement-poster skeleton" />
      <div className="announcement-body">
        <div className="skeleton skeleton-badge" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
      </div>
    </div>
  );
}

/**
 * Cinematic hero slideshow (sits BELOW the permanent overlay — see .hero-bg in home.css).
 *
 * Each slide runs `dynamicFadeZoom` once: fade in over the first 15%, hold, fade out
 * over the last 15%, zooming 1.00 → 1.04 throughout. The animation lasts
 * interval ÷ 0.85, so a slide's fade-out overlaps the next slide's fade-in exactly.
 *
 * `starts[i]` counts how often slide i has become active; it is part of the React key,
 * so a slide returning to the front remounts and replays its animation from 0%,
 * while the outgoing slide keeps its key and finishes its fade-out undisturbed.
 */
function HeroSlideshow({ slides, interval }) {
  const [slide, setSlide] = useState(() => ({
    active: 0,
    previous: null,
    starts: slides.map((_, i) => (i === 0 ? 1 : 0))
  }));
  const [animated] = useState(
    () => slides.length > 1 && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (!animated) return undefined;

    const timer = setInterval(() => {
      setSlide(({ active, starts }) => {
        const next = (active + 1) % slides.length;
        const nextStarts = [...starts];
        nextStarts[next] += 1;
        return { active: next, previous: active, starts: nextStarts };
      });
    }, interval);
    return () => clearInterval(timer);
  }, [animated, slides.length, interval]);

  return (
    <div className="hero-slides" style={{ '--slide-duration': `${Math.round(interval / 0.85)}ms` }}>
      {slides.map((src, index) => {
        let state = '';
        if (index === slide.active) state = animated ? 'is-active' : 'is-static';
        else if (animated && index === slide.previous) state = 'is-leaving';

        return (
          <div
            key={`${src}:${slide.starts[index]}`}
            className={`hero-slide ${state}`.trim()}
            style={{ backgroundImage: `url('${src}')` }}
          />
        );
      })}
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
        // Flag posts published within the last 48 hours (evaluated once, at load time).
        const loadedAt = Date.now();
        setAnnouncements(
          items.map((item) => {
            const published = toDate(item.publishedAt || item.createdAt);
            return { ...item, isNew: Boolean(published) && loadedAt - published.getTime() <= NEW_POST_WINDOW_MS };
          })
        );
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
                <Sw>{swahiliLabels.sabbathGlance}</Sw>
              </div>
            </div>
            <ul className="hero-schedule">
              {sabbathSchedule.map((item) => (
                <li key={item.title}>
                  <span className="hero-schedule-time">{item.time}</span>
                  <span className="hero-schedule-title">
                    {item.title}
                    {item.sw && <Sw>{item.sw}</Sw>}
                  </span>
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
            <h2 className="section-title">Announcements</h2>
            <Sw className="sw-section">{swahiliLabels.announcements}</Sw>
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
            <Sw className="sw-section">{swahiliLabels.ministries}</Sw>
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
              <Sw className="sw-card">{swahiliLabels.sabbathGuidelines}</Sw>
              <ul className="ministry-schedule">
                {sabbathSchedule.map((item) => (
                  <li key={item.title}>
                    <span>{item.time}</span>
                    <strong>
                      {item.title}
                      {item.sw && <Sw>{item.sw}</Sw>}
                    </strong>
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
              <Sw className="sw-card">{swahiliLabels.fellowship}</Sw>
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
              <Sw className="sw-card">{swahiliLabels.welfare}</Sw>
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
            <Sw className="sw-band">{swahiliLabels.join}</Sw>
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
