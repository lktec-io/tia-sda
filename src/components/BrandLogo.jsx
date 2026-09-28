import { useState } from 'react';

// Renders /public/logo.png inside the gold-ringed circle.
// Falls back to the "T" monogram until the logo file is added.
export default function BrandLogo({ className = '' }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={`logo-circle ${className}`.trim()}>
      {failed ? (
        <span aria-hidden="true">T</span>
      ) : (
        <img src="/logo.png" alt="TUCASA TIA Mbeya logo" onError={() => setFailed(true)} />
      )}
    </span>
  );
}
