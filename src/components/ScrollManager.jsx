import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const HASH_WAIT_MS = 3000;

// Scrolls to the top on page change, or to the #section when the URL has a hash
// (e.g. "/#announcements", "/leader?fee=unpaid#cc-registry"). Lazy pages render a
// moment later, so the target is looked for on each frame for up to 3 seconds.
export default function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const started = performance.now();
      let frame = 0;
      const seek = () => {
        const target = document.getElementById(hash.slice(1));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (performance.now() - started < HASH_WAIT_MS) {
          frame = requestAnimationFrame(seek);
        }
      };
      frame = requestAnimationFrame(seek);
      return () => cancelAnimationFrame(frame);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
