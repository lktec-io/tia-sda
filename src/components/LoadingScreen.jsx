import BrandLogo from './BrandLogo';

export default function LoadingScreen({ label = 'Loading your portal...' }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <BrandLogo />
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}
