import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { GoogleLogin } from '../../auth/google';
import RippleButton from '../RippleButton';

export default function SignIn() {
  const { loginWithEmail, loginWithGoogle, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const session = await loginWithEmail(email, password);
      nav(session?.role === 'admin' ? '/wellspring' : '/', { replace: true });
    } catch (err) {
      // Provide user-friendly error messages
      const errorMsg = err.message || 'Failed to sign in';
      if (errorMsg.includes('Invalid email or password')) {
        setError('Incorrect email or password. Please check your credentials and try again.');
      } else if (errorMsg.includes('Google Sign-In')) {
        setError('This account uses Google Sign-In. Please use the "Continue with Google" button below.');
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(errorMsg);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 md:p-10 border border-yellow-100 space-y-6 animate-fade-in">
        <div className="text-center">
          <img className="w-12 h-12 mx-auto" src="/logo.png" alt="Charitap" />
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Sign in to Charitap</h1>
          <p className="text-gray-600">Join your clicks to a cause — every tap counts.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">{error}</div>
        )}

        <form className="space-y-4" onSubmit={handleEmailLogin}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
              <button type="button" aria-label="Toggle password visibility" className="absolute right-3 top-3.5 text-sm text-gray-500" onClick={() => setShowPassword(v => !v)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <RippleButton type="submit" className="w-full bg-black text-white hover:bg-yellow-300 hover:text-black px-5 py-2.5 rounded-full font-semibold transition-colors">
            {isLoading ? 'Signing in...' : 'Sign In'}
          </RippleButton>
        </form>

        <div className="my-4 flex items-center">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="px-3 text-xs text-gray-400">or continue with</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="w-full">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="flex flex-col items-center space-y-3">
                <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-gray-600 font-medium">Signing you in...</p>
              </div>
            </div>
          ) : (
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                try {
                  setLoading(true);
                  setError(''); // Clear any previous errors
                  const session = await loginWithGoogle(credentialResponse.credential);
                  // Redirect immediately without delay
                  window.location.href = session?.role === 'admin' ? '/wellspring' : '/';
                } catch (e) {
                  // Provide user-friendly error messages for Google OAuth
                  const errorMsg = e.message || 'Google sign-in failed';
                  if (errorMsg.includes('account with this email already exists')) {
                    setError('An account with this email already exists. Please use email/password login above.');
                  } else if (errorMsg.includes('popup')) {
                    setError('Popup was blocked. Please allow popups for this site and try again.');
                  } else if (errorMsg.includes('cancelled')) {
                    setError('Google sign-in was cancelled. Please try again if you want to continue.');
                  } else {
                    setError(errorMsg);
                  }
                  setLoading(false);
                }
              }}
              onError={() => {
                setError('Google sign-in failed. Please make sure you have a stable internet connection and try again.');
                setLoading(false);
              }}
              useOneTap={false}
              theme="outline"
              size="large"
              text="continue_with"
              shape="pill"
              width="100%"
            />
          )}
        </div>

        <p className="text-xs text-gray-500 mt-3 text-center">We’ll never post without your permission. Payments use bank‑grade encryption via Stripe.</p>

        <p className="text-sm text-gray-600 mt-6 text-center">
          New here?{' '}
          <Link to="/signup" className="text-yellow-600 hover:text-yellow-700 font-semibold">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

