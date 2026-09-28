import { lazy } from 'react';

const RELOAD_FLAG = 'tucasa:chunk-reload';

/**
 * React.lazy with one automatic recovery: after a new deploy, an open tab may request
 * chunk files that no longer exist. Reload once to fetch the fresh index.html.
 */
export default function lazyPage(factory) {
  return lazy(async () => {
    try {
      const module = await factory();
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        // storage unavailable (private mode) — nothing to clear
      }
      return module;
    } catch (error) {
      let alreadyReloaded;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
        if (!alreadyReloaded) sessionStorage.setItem(RELOAD_FLAG, '1');
      } catch {
        alreadyReloaded = true; // can't track reloads safely, so don't loop
      }
      if (!alreadyReloaded) {
        window.location.reload();
        return new Promise(() => {}); // keep Suspense fallback up while reloading
      }
      throw error;
    }
  });
}
