// src/components/ProtectedRoute.js
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { toast } from 'react-toastify';

export default function ProtectedRoute({ element: Component }) {
  const { isAuthenticated, isLoading } = useAuth();
  const bypass = process.env.REACT_APP_AUTH_BYPASS === 'true';
  const [redirect, setRedirect] = useState(false);

  // when we know auth status and it's false, kick off toast + delayed redirect
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !bypass) {
      toast.info('Please log in to view that page.', { autoClose: 2000 });
      const timer = setTimeout(() => setRedirect(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, bypass]);

  // 1) Loading spinner
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
        <div className="w-14 h-14 border-4 border-yellow-200 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 2) Not authenticated → show overlay then redirect (unless bypass)
  if (!isAuthenticated && !bypass) {
    if (redirect) {
      return <Navigate to="/" replace />;
    }
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
        <div className="bg-white bg-opacity-90 p-8 rounded-2xl shadow-xl max-w-sm text-center border border-yellow-100 animate-fade-in">
          <p className="text-xl font-bold text-yellow-700 mb-2">Login Required</p>
          <p className="text-gray-700 mb-2 text-base">Please log in to access this page.</p>
          <p className="text-gray-500 italic text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  // 3) Authenticated or bypass → render the page with a fade-in
  return (
    <div className="fade-in">
      <Component />
    </div>
  );
}
