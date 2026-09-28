import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Scrolls to the top on page change, or to the #section when the URL has a hash
// (e.g. navigating from the workspace to "/#announcements").
export default function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const frame = requestAnimationFrame(() => {
        document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
      });
      return () => cancelAnimationFrame(frame);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
