import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import {
  CalendarIcon,
  CloseIcon,
  GridIcon,
  HomeIcon,
  LogoutIcon,
  MegaphoneIcon,
  MenuIcon,
  SendIcon,
  ShieldIcon,
  UserIcon,
  UsersIcon
} from '../components/Icons';
import MemberAvatar from '../components/MemberAvatar';
import useRoleAnnouncements from '../hooks/useRoleAnnouncements';
import useDirectorySync from '../hooks/useDirectorySync';
import { formatRole } from '../data/constants';
import '../styles/dashboard.css';

const MEMBER_NAV = [
  { to: '/dashboard', label: 'Dashboard Overview', icon: GridIcon, end: true },
  { to: '/dashboard/announcements', label: 'Internal Announcements', icon: MegaphoneIcon },
  { to: '/dashboard/directory', label: 'Flock Directory', sw: 'Orodha ya Washiriki', icon: UsersIcon },
  { to: '/dashboard/roster', label: 'Worship Roster', sw: 'Ratiba ya Wahudumu', icon: CalendarIcon },
  { to: '/dashboard/profile', label: 'My Profile', icon: UserIcon }
];

const LEADER_NAV = [
  { to: '/leader', label: 'Command Center', icon: ShieldIcon, end: true },
  { to: '/leader/publish', label: 'Publish Announcement', icon: SendIcon },
  { to: '/dashboard/schedule-worship', label: 'Manage Roster', sw: 'Panga Wahudumu', icon: CalendarIcon }
];

const PAGE_TITLES = {
  '/dashboard': 'Dashboard Overview',
  '/dashboard/announcements': 'Internal Announcements',
  '/dashboard/directory': 'Flock Directory',
  '/dashboard/roster': 'Worship Roster',
  '/dashboard/schedule-worship': 'Manage Worship Roster',
  '/dashboard/profile': 'My Profile',
  '/leader': 'Leadership Command Center',
  '/leader/publish': 'Publish Announcement'
};

function SidebarLink({ item, onNavigate, alertCount = 0 }) {
  const Icon = item.icon;
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive }) => `side-link ${isActive ? 'is-active' : ''}`}
        onClick={onNavigate}
      >
        <Icon width={18} height={18} />
        <span>
          {item.label}
          {item.sw && <small className="side-link-sw" lang="sw">{item.sw}</small>}
        </span>
        {alertCount > 0 && (
          <span
            className="red-alert-pulse"
            role="status"
            aria-label={`${alertCount} new announcement${alertCount === 1 ? '' : 's'} in the last 48 hours`}
          />
        )}
      </NavLink>
    </li>
  );
}

/**
 * Portal shell shared by the Member Workspace and the Leadership Command Center:
 * responsive sidebar drawer + top bar, with the active view rendered in <Outlet />.
 */
export default function Dashboard() {
  const { currentUser, userProfile, isLeader, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Posts published in the last 48 h for this user's audience → crimson nav alert.
  const { recentCount } = useRoleAnnouncements();
  // Keeps this user's Flock Directory card (photo, name, course, ministry) current.
  useDirectorySync(userProfile);

  const fullName = userProfile?.fullName || currentUser?.email || 'Member';
  const statusLabel = `Active ${formatRole(userProfile)}`;
  const cleanPath = pathname.replace(/\/$/, '');
  const pageTitle =
    PAGE_TITLES[cleanPath] || (cleanPath.startsWith('/leader/publish/') ? 'Edit Announcement' : 'Member Portal');

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      setSigningOut(false);
    }
  };

  return (
    <div className={`portal ${drawerOpen ? 'drawer-open' : ''}`}>
      <aside className="sidebar" id="portal-sidebar" aria-label="Portal navigation">
        <div className="sidebar-head">
          <Link to="/" className="sidebar-brand" onClick={closeDrawer}>
            <BrandLogo />
            <span>
              <strong>TUCASA</strong>
              <small>TIA Mbeya Portal</small>
            </span>
          </Link>
          <button type="button" className="sidebar-close" onClick={closeDrawer} aria-label="Close navigation">
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <p className="sidebar-label">Workspace</p>
          <ul>
            {MEMBER_NAV.map((item) => (
              <SidebarLink
                key={item.to}
                item={item}
                onNavigate={closeDrawer}
                alertCount={item.to === '/dashboard/announcements' ? recentCount : 0}
              />
            ))}
          </ul>

          {isLeader && (
            <>
              <p className="sidebar-label sidebar-label-gold">Leadership</p>
              <ul>
                {LEADER_NAV.map((item) => (
                  <SidebarLink key={item.to} item={item} onNavigate={closeDrawer} />
                ))}
              </ul>
            </>
          )}
        </nav>

        <div className="sidebar-foot">
          <Link to="/" className="side-link" onClick={closeDrawer}>
            <HomeIcon width={18} height={18} />
            <span>Public Website</span>
          </Link>
        </div>
      </aside>

      <button
        type="button"
        className="sidebar-scrim"
        onClick={closeDrawer}
        aria-label="Close navigation"
        tabIndex={drawerOpen ? 0 : -1}
      />

      <div className="portal-body">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="topbar-menu"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              aria-controls="portal-sidebar"
              aria-expanded={drawerOpen}
            >
              <MenuIcon />
              {/* On phones the sidebar is hidden, so surface the new-post alert here too. */}
              {recentCount > 0 && <span className="red-alert-pulse red-alert-corner" aria-hidden="true" />}
            </button>
            <h1 className="topbar-title">{pageTitle}</h1>
          </div>

          <div className="topbar-right">
            <div className="topbar-user">
              <MemberAvatar
                name={userProfile?.fullName || currentUser?.email || ''}
                photoUrl={userProfile?.profilePictureUrl}
                showStatus
              />
              <span className="topbar-user-text">
                <strong>{fullName}</strong>
                <small>
                  <span className="status-dot" aria-hidden="true" />
                  {statusLabel}
                </small>
              </span>
            </div>

            <button type="button" className="btn-logout" onClick={handleLogout} disabled={signingOut}>
              <LogoutIcon width={17} height={17} />
              <span>{signingOut ? 'Signing out...' : 'Logout'}</span>
            </button>
          </div>
        </header>

        <main className="portal-main">
          {/* Keeps the sidebar and top bar on screen while a view's chunk loads. */}
          <Suspense
            fallback={
              <div className="panel panel-loading" role="status">
                <span className="spinner" />
                <span>Loading...</span>
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
