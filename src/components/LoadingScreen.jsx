import BrandLogo from './BrandLogo';

// Full-page loader: the church logo sits at the absolute centre, wrapped by a
// slowly rotating gold ring, with the status label beneath.
export default function LoadingScreen({ label = 'Loading your portal...' }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-mark">
        <span className="loading-ring" aria-hidden="true" />
        <BrandLogo className="logo-loading" />
      </div>
      <span className="loading-label">{label}</span>
    </div>
  );
}
