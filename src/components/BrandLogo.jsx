import { useState } from 'react';

// Official church logo, served from /public/logo.png.
export const LOGO_SRC = '/logo.png';

/**
 * Standard church logo inside the gold-ringed brand circle. Used by the navbar, auth
 * card headers, dashboard sidebar, footer and the loading screen. If /logo.png is not
 * present yet, the image is hidden and only the branded ring shows (no letter fallback).
 */
export default function BrandLogo({ className = '' }) {
  const [missing, setMissing] = useState(false);

  return (
    <span className={`logo-circle ${className}`.trim()}>
      {!missing && (
        <img src={LOGO_SRC} alt="TUCASA TIA Mbeya — TIA SDA Church logo" onError={() => setMissing(true)} />
      )}
    </span>
  );
}
