import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from './BrandLogo';
import { CloseIcon, MenuIcon } from './Icons';

const NAV_LINKS = [
  { href: '#announcements', label: 'Announcements' },
  { href: '#ministries', label: 'Ministries' },
  { href: '#visit', label: 'Visit Us' }
];

export default function Navbar() {
  const { currentUser } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMenu = () => setOpen(false);
  const isSignedIn = Boolean(currentUser);

  return (
    <header className={`navbar ${scrolled || open ? 'navbar-solid' : ''}`}>
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand" onClick={closeMenu}>
          <BrandLogo />
          <span className="navbar-brand-text">
            <strong>TUCASA</strong>
            <small>TIA Mbeya · SDA Student Church</small>
          </span>
        </Link>

        <button
          type="button"
          className="navbar-toggle"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls="primary-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>

        <nav id="primary-nav" className={`navbar-menu ${open ? 'is-open' : ''}`}>
          <ul className="navbar-links">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} onClick={closeMenu}>{link.label}</a>
              </li>
            ))}
          </ul>

          <div className="navbar-actions">
            {isSignedIn ? (
              <Link to="/dashboard" className="btn btn-gold btn-sm" onClick={closeMenu}>
                My Workspace
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-glass btn-sm" onClick={closeMenu}>Sign In</Link>
                <Link to="/register" className="btn btn-gold btn-sm" onClick={closeMenu}>Join</Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
