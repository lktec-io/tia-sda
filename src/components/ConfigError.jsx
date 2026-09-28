import BrandLogo from './BrandLogo';

// Shown instead of the app when Firebase env vars are missing,
// so a misconfigured build never renders a blank white page.
export default function ConfigError({ missing }) {
  const isDev = import.meta.env.DEV;

  return (
    <div className="config-error">
      <div className="config-error-card">
        <BrandLogo />
        <h1>{isDev ? 'Firebase is not configured' : 'Portal temporarily unavailable'}</h1>

        {isDev ? (
          <>
            <p>The following variables are missing or empty in <code>.env.local</code>:</p>
            <ul>
              {missing.map((name) => (
                <li key={name}><code>{name}</code></li>
              ))}
            </ul>
            <ol>
              <li>Open Firebase Console → Project settings → Your apps → Web app → Config.</li>
              <li>Paste each value into <code>.env.local</code> (see <code>.env.example</code>).</li>
              <li>Stop and restart <code>npm run dev</code>.</li>
              <li>Run <code>npm run check:firebase</code> to verify the connection.</li>
            </ol>
          </>
        ) : (
          <p>
            The TUCASA TIA Mbeya portal is being configured. Please try again shortly or contact the
            church leadership.
          </p>
        )}
      </div>
    </div>
  );
}
