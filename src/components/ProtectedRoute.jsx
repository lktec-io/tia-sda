import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';

/**
 * Guards internal routes.
 * - Waits for the auth session + Firestore profile before deciding (no flicker).
 * - Signed-out visitors go to /login, remembering where they were headed.
 * - Accounts are active immediately after registration; a signed-in user without a
 *   profile document goes to /login, which explains the problem.
 * - Optional `allowedRoles` limits a route to specific roles.
 *
 * Use as a layout route: <Route element={<ProtectedRoute />}>...</Route>
 * or wrap directly:     <ProtectedRoute><Page /></ProtectedRoute>
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const { currentUser, userProfile, userRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen label="Opening your workspace..." />;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!userProfile) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children ?? <Outlet />;
}
