import React, { Suspense, lazy } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { GoogleOAuthProvider } from './auth/google';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/main.css';

// Lazy load components for better performance
const Home = lazy(() => import('./components/Home'));
const Charities = lazy(() => import('./components/Charities'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Activity = lazy(() => import('./components/Activity'));
const Settings = lazy(() => import('./components/Settings'));
const Impact = lazy(() => import('./components/Impact'));
const SignIn = lazy(() => import('./components/auth/SignIn'));
const SignUp = lazy(() => import('./components/auth/SignUp'));
const CompleteProfile = lazy(() => import('./components/auth/CompleteProfile'));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'));
const WellspringApp = lazy(() => import('./pages/Wellspring/WellspringApp'));

// Loading component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-50">
    <div className="text-center">
      <div className="spinner mx-auto mb-4"></div>
      <p className="text-gray-600 animate-pulse">Loading Charitap...</p>
    </div>
  </div>
);

function App() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const isAdmin = isAuthenticated && user?.role === 'admin' && user?.adminScope === 'wellspring';
  const hideChrome = ['/signin', '/signup', '/complete-profile', '/wellspring'].includes(location.pathname);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const RoleHome = () => (isAdmin ? <Navigate to="/wellspring" replace /> : <Home />);
  const UserRoute = ({ element: Component }) => {
    if (isAdmin) return <Navigate to="/wellspring" replace />;
    return <ProtectedRoute element={Component} />;
  };
  const NonAdminRoute = ({ element: Component }) => {
    if (isAdmin) return <Navigate to="/wellspring" replace />;
    return <Component />;
  };
  const AdminRoute = () => {
    if (!isAuthenticated) return <Navigate to="/signin" replace />;
    if (!isAdmin) return <Navigate to="/dashboard" replace />;
    return <WellspringApp />;
  };

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || 'your_google_client_id_here'}>
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50">
          {!hideChrome && <Navigation />}
          <main className="flex-1">
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<RoleHome />} />
                {/* Public home currently not used */}
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/complete-profile" element={<CompleteProfile />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/charities" element={<UserRoute element={Charities} />} />
                <Route path="/impact" element={<NonAdminRoute element={Impact} />} />
                <Route path="/dashboard" element={<UserRoute element={Dashboard} />} />
                <Route path="/activity" element={<UserRoute element={Activity} />} />
                <Route path="/settings" element={<UserRoute element={Settings} />} />
                <Route path="/wellspring" element={<AdminRoute />} />
              </Routes>
            </Suspense>
          </main>
          {!hideChrome && <Footer />}
        </div>
      </ErrorBoundary>
    </GoogleOAuthProvider>
  );
}

export default App;
