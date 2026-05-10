import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import RippleButton from '../RippleButton';

export default function CompleteProfile() {
  const { saveName, authProvider, finalizeEmailSignup } = useAuth();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nav = useNavigate();

  const isGoogle = authProvider === 'google';

  useEffect(() => {
    if (isGoogle) {
      // If from Google, names should already be present; route to settings
      nav('/settings', { replace: true });
    }
  }, [isGoogle, nav]);

  // Prevent navigation away from this page if names are not filled
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isGoogle && (!first.trim() || !last.trim())) {
        e.preventDefault();
        e.returnValue = 'Please complete your profile before leaving this page.';
        return 'Please complete your profile before leaving this page.';
      }
    };

    const handlePopState = (e) => {
      if (!isGoogle && (!first.trim() || !last.trim())) {
        e.preventDefault();
        window.history.pushState(null, '', window.location.pathname);
        alert('Please complete your profile before navigating away.');
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    // Push current state to prevent back button
    if (!isGoogle && (!first.trim() || !last.trim())) {
      window.history.pushState(null, '', window.location.pathname);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [first, last, isGoogle]);

  const handleSaveAndContinue = async () => {
    if (!first.trim() || !last.trim()) {
      alert('Please enter both first and last name to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      await saveName(first.trim(), last.trim());
      // finalize signup after email verified code screen
      if (sessionStorage.getItem('charitap_email_verified') === '1') {
        await finalizeEmailSignup();
      }
      nav('/settings', { replace: true });
    } catch (error) {
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = first.trim() && last.trim();

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 md:p-10 border border-yellow-100 space-y-6 animate-fade-in">
        <div className="text-center">
          <img className="w-12 h-12 mx-auto" src="/logo.png" alt="Charitap" />
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Complete your profile</h1>
          <p className="text-gray-600">Add your name to continue</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
            <input
              type="text"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
            <input
              type="text"
              value={last}
              onChange={(e) => setLast(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            />
          </div>
          <RippleButton
            onClick={handleSaveAndContinue}
            disabled={!isFormValid || isSubmitting}
            className={`w-full bg-black text-white hover:bg-yellow-300 hover:text-black px-5 py-2.5 rounded-full text-sm font-semibold ${!isFormValid || isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? 'Saving...' : 'Save and Continue'}
          </RippleButton>
        </div>
      </div>
    </div>
  );
}


