import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '../../auth/google';
import RippleButton from '../RippleButton';

export default function SignUp() {
  const { signupWithEmail, loginWithGoogle, isLoading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password strength validation with visual feedback
  const getPasswordStrength = (pwd) => {
    const minLen = pwd.length >= 8;
    const hasLetter = /[A-Za-z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSymbol = /[!@#$%^&*()_+=[\]{};':"\\|,.<>/?]/.test(pwd);
    
    const checks = { minLen, hasLetter, hasNumber, hasSymbol };
    const passedChecks = Object.values(checks).filter(Boolean).length;
    
    let strength = 'weak';
    let color = 'red';
    if (passedChecks === 4) {
      strength = 'strong';
      color = 'green';
    } else if (passedChecks >= 3) {
      strength = 'medium';
      color = 'yellow';
    }
    
    return { checks, strength, color, passedChecks, totalChecks: 4 };
  };

  const passwordStrength = getPasswordStrength(password);
  const allRequirementsMet = passwordStrength.passedChecks === 4;

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setError('');
    
    // Check if all password requirements are met
    if (!allRequirementsMet) {
      setError('Please meet all password requirements before signing up.');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match. Please make sure both passwords are identical.');
      return;
    }

    // Validate email format with proper @ and .com validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address (e.g., user@example.com).');
      return;
    }

    try {
      await signupWithEmail(email, password);
      nav('/complete-profile');
    } catch (err) {
      // Provide user-friendly error messages
      const errorMsg = err.message || 'Failed to sign up';
      if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
        setError('An account with this email already exists. Redirecting to sign in...');
        setTimeout(() => nav('/signin'), 2000);
      } else if (errorMsg.includes('invalid email')) {
        setError('Please enter a valid email address (e.g., user@example.com).');
      } else if (errorMsg.includes('password')) {
        setError('Password must meet the requirements. Please try a different password.');
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(errorMsg);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 md:p-10 border border-yellow-100 space-y-6 animate-fade-in my-8">
        <div className="text-center mb-6">
          <img className="w-12 h-12 mx-auto" src="/logo.png" alt="Charitap" />
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Create your Charitap account</h1>
          <p className="text-gray-600">It takes less than a minute to start giving with every click.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">{error}</div>
        )}

        <form className="space-y-4" onSubmit={handleEmailSignup}>
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
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
              <button type="button" aria-label="Toggle password visibility" className="absolute right-3 top-3.5 text-sm text-gray-500" onClick={() => setShowPw(v => !v)}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            
            {/* Password Strength Indicator */}
            {password && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">Password strength:</span>
                  <span className={`text-xs font-semibold ${
                    passwordStrength.color === 'green' ? 'text-green-600' :
                    passwordStrength.color === 'yellow' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {passwordStrength.strength.toUpperCase()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      passwordStrength.color === 'green' ? 'bg-green-500' :
                      passwordStrength.color === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${(passwordStrength.passedChecks / passwordStrength.totalChecks) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            {/* Password Requirements Checklist */}
            {password && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center text-xs">
                  <span className={`mr-2 ${passwordStrength.checks.minLen ? 'text-green-600' : 'text-gray-400'}`}>
                    {passwordStrength.checks.minLen ? '✓' : '○'}
                  </span>
                  <span className={passwordStrength.checks.minLen ? 'text-green-600' : 'text-gray-600'}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center text-xs">
                  <span className={`mr-2 ${passwordStrength.checks.hasLetter ? 'text-green-600' : 'text-gray-400'}`}>
                    {passwordStrength.checks.hasLetter ? '✓' : '○'}
                  </span>
                  <span className={passwordStrength.checks.hasLetter ? 'text-green-600' : 'text-gray-600'}>
                    At least one letter
                  </span>
                </div>
                <div className="flex items-center text-xs">
                  <span className={`mr-2 ${passwordStrength.checks.hasNumber ? 'text-green-600' : 'text-gray-400'}`}>
                    {passwordStrength.checks.hasNumber ? '✓' : '○'}
                  </span>
                  <span className={passwordStrength.checks.hasNumber ? 'text-green-600' : 'text-gray-600'}>
                    At least one number
                  </span>
                </div>
                <div className="flex items-center text-xs">
                  <span className={`mr-2 ${passwordStrength.checks.hasSymbol ? 'text-green-600' : 'text-gray-400'}`}>
                    {passwordStrength.checks.hasSymbol ? '✓' : '○'}
                  </span>
                  <span className={passwordStrength.checks.hasSymbol ? 'text-green-600' : 'text-gray-600'}>
                    At least one symbol (!@#$%^&*...)
                  </span>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full px-3 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
              <button type="button" aria-label="Toggle confirm visibility" className="absolute right-3 top-3.5 text-sm text-gray-500" onClick={() => setShowConfirm(v => !v)}>
                {showConfirm ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <RippleButton 
            type="submit" 
            disabled={!allRequirementsMet || password !== confirm || isLoading}
            className={`w-full px-5 py-2.5 rounded-full font-semibold transition-colors ${
              allRequirementsMet && password === confirm && !isLoading
                ? 'bg-black text-white hover:bg-yellow-300 hover:text-black'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? 'Creating account...' : 'Sign Up'}
          </RippleButton>
        </form>

        <div className="my-4 flex items-center">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="px-3 text-xs text-gray-400">or sign up with</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="w-full">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="flex flex-col items-center space-y-3">
                <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-gray-600 font-medium">Signing you up...</p>
              </div>
            </div>
          ) : (
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                console.log('Google OAuth Success:', credentialResponse);
                try {
                  setLoading(true);
                  setError(''); // Clear any previous errors
                  const result = await loginWithGoogle(credentialResponse.credential);
                  console.log('Login result:', result);
                  // Redirect immediately without delay
                  window.location.href = result?.role === 'admin' ? '/wellspring' : '/';
                } catch (e) {
                  console.error('Google OAuth Error:', e);
                  // Provide user-friendly error messages for Google OAuth
                  const errorMsg = e.message || 'Google sign-up failed';
                  if (errorMsg.includes('account with this email already exists')) {
                    setError('An account with this email already exists. Please sign in instead.');
                  } else if (errorMsg.includes('popup')) {
                    setError('Popup was blocked. Please allow popups for this site and try again.');
                  } else if (errorMsg.includes('cancelled')) {
                    setError('Google sign-up was cancelled. Please try again if you want to continue.');
                  } else {
                    setError(errorMsg);
                  }
                  setLoading(false);
                }
              }}
              onError={() => {
                setError('Google sign-up failed. Please make sure you have a stable internet connection and try again.');
                setLoading(false);
              }}
              useOneTap={false}
              theme="outline"
              size="large"
              text="signup_with"
              shape="pill"
              width="100%"
            />
          )}
        </div>

        <p className="text-sm text-gray-600 mt-6 text-center">
          Already have an account?{' '}
          <Link to="/signin" className="text-yellow-600 hover:text-yellow-700 font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

