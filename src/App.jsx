import { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LeaderGuard from './components/LeaderGuard';
import ScrollManager from './components/ScrollManager';
import LoadingScreen from './components/LoadingScreen';
import lazyPage from './lib/lazyPage';
// The landing page stays in the main bundle so first-time visitors see it instantly.
import Home from './pages/Home';

// Everything else is split into on-demand chunks (with the Firebase SDK in its own chunks).
const Login = lazyPage(() => import('./pages/Login'));
const Registration = lazyPage(() => import('./pages/Registration'));
const Dashboard = lazyPage(() => import('./pages/Dashboard'));
const Overview = lazyPage(() => import('./pages/portal/Overview'));
const MemberAnnouncements = lazyPage(() => import('./pages/portal/MemberAnnouncements'));
const MyProfile = lazyPage(() => import('./pages/portal/MyProfile'));
const CommandCenter = lazyPage(() => import('./pages/leader/CommandCenter'));
const AnnouncementPublisher = lazyPage(() => import('./pages/leader/AnnouncementPublisher'));

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollManager />
        <Suspense fallback={<LoadingScreen label="Loading..." />}>
          <Routes>
            {/* Public website (surfing mode) */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Registration />} />

            {/* Internal portal — any signed-in account with a profile */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Dashboard />}>
                {/* Phase 3: Member workspace */}
                <Route path="/dashboard" element={<Overview />} />
                <Route path="/dashboard/announcements" element={<MemberAnnouncements />} />
                <Route path="/dashboard/profile" element={<MyProfile />} />

                {/* Phase 4: Leadership command center */}
                <Route element={<LeaderGuard />}>
                  <Route path="/leader" element={<CommandCenter />} />
                  <Route path="/leader/publish" element={<AnnouncementPublisher />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
