import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-yellow-50 via-white to-blue-50 px-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-yellow-200 rounded-full opacity-20 animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-24 h-24 bg-blue-200 rounded-full opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-10 w-16 h-16 bg-green-200 rounded-full opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      
      {/* Main content */}
      <div className="text-center z-10 animate-fade-in-up">
        {/* Animated 404 */}
        <div className="mb-8">
          <h1 className="text-8xl md:text-9xl font-extrabold text-yellow-400 mb-4 animate-bounce">
            4
            <span className="inline-block animate-pulse" style={{ animationDelay: '0.5s' }}>0</span>
            <span className="inline-block animate-pulse" style={{ animationDelay: '1s' }}>4</span>
          </h1>
        </div>
        
        {/* Illustration */}
        <div className="mb-8 relative">
          <div className="w-48 h-48 mx-auto bg-gradient-to-br from-yellow-200 to-yellow-300 rounded-full flex items-center justify-center shadow-lg animate-pulse">
            <svg className="w-24 h-24 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
            </svg>
          </div>
          <div className="absolute -top-4 -right-4 w-8 h-8 bg-red-400 rounded-full animate-bounce"></div>
          <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }}></div>
        </div>
        
        <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Oops! Page Not Found</h2>
        <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
          The page you're looking for seems to have wandered off. Don't worry, we'll help you find your way back!
        </p>
        
        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <Link 
            to="/" 
            className="px-8 py-3 bg-yellow-400 text-black font-semibold rounded-full hover:bg-yellow-500 hover:scale-105 active:scale-95 transition-all duration-200 transform shadow-lg"
          >
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" />
              </svg>
              Go Home
            </span>
          </Link>
          <button 
            onClick={() => window.history.back()} 
            className="px-8 py-3 bg-gray-200 text-gray-800 font-semibold rounded-full hover:bg-gray-300 hover:scale-105 active:scale-95 transition-all duration-200 transform shadow-lg"
          >
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Go Back
            </span>
          </button>
        </div>
        
        {/* Helpful links */}
        <div className="text-sm text-gray-500">
          <p className="mb-2">Need help? Try these pages:</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/activity" className="text-blue-600 hover:text-blue-800 underline">Activity</Link>
            <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 underline">Dashboard</Link>
            <Link to="/settings" className="text-blue-600 hover:text-blue-800 underline">Settings</Link>
          </div>
        </div>
      </div>
    </div>
  );
} 