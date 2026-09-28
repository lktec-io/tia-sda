import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LockIcon } from './Icons';
import { ROLE_LABELS } from '../data/constants';

/**
 * Leader-only gate. Renders nothing from the protected view unless the signed-in
 * profile's role is 'leader' — everyone else sees an Access Denied state.
 * (Must sit inside <ProtectedRoute>, which already guarantees a signed-in profile.)
 */
export default function LeaderGuard({ children }) {
  const { userRole, isLeader } = useAuth();

  if (!isLeader) {
    return (
      <div className="view">
        <section className="access-denied">
          <span className="access-denied-icon">
            <LockIcon width={30} height={30} />
          </span>
          <h2>Access Denied</h2>
          <p>
            The Leadership Command Center is restricted to TUCASA TIA Mbeya leaders. Your account is
            registered as <strong>{ROLE_LABELS[userRole] || userRole || 'unknown'}</strong>.
          </p>
          <p className="access-denied-hint">
            If you believe this is a mistake, please contact the church secretary.
          </p>
          <Link to="/dashboard" className="btn btn-primary">Back to My Workspace</Link>
        </section>
      </div>
    );
  }

  return children ?? <Outlet />;
}
