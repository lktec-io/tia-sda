import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import {
  CloseIcon,
  GridIcon,
  HomeIcon,
  LogoutIcon,
  MegaphoneIcon,
  MenuIcon,
  SendIcon,
  ShieldIcon,
  UserIcon
} from '../components/Icons';
import MemberAvatar from '../components/MemberAvatar';
import { formatRole } from '../data/constants';
import '../styles/dashboard.css';

const MEMBER_NAV = [
  { to: '/dashboard', label: 'Dashboard Overview', icon: GridIcon, end: true },
  { to: '/dashboard/announcements', label: 'Internal Announcements', icon: MegaphoneIcon },
  { to: '/dashboard/profile', label: 'My Profile', icon: UserIcon }
];

const LEADER_NAV = [
  { to: '/leader', label: 'Command Center', icon: ShieldIcon, end: true },
  { to: '/leader/publish', label: 'Publish Announcement', icon: SendIcon }
];

const PAGE_TITLES = {
  '/dashboard': 'Dashboard Overview',
  '/dashboard/announcements': 'Internal Announcements',
  '/dashboard/profile': 'My Profile',
  '/leader': 'Leadership Command Center',
  '/leader/publish': 'Publish Announcement'
};

function SidebarLink({ item, onNavigate }) {
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
        <span>{item.label}</span>
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

  const fullName = userProfile?.fullName || currentUser?.email || 'Member';
  const statusLabel = `Active ${formatRole(userProfile)}`;
  const pageTitle = PAGE_TITLES[pathname.replace(/\/$/, '')] || 'Member Portal';

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
              <SidebarLink key={item.to} item={item} onNavigate={closeDrawer} />
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
