import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-[#FCF8F1] border-t border-gray-200 py-10 mt-16 w-full" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between">
        <div className="flex items-center space-x-3 mb-4 md:mb-0">
          <img src="/logo.png" alt="Charitap Logo" className="h-8 w-8 rounded-full" />
          <span className="font-bold text-lg text-yellow-400">Charitap</span>
          <span className="ml-4 text-gray-700 text-sm italic max-w-xs hidden md:inline-block border-l border-gray-300 pl-4">A micro-donation platform that lets users round up everyday purchases and automatically donate the spare change to a charity of your choice.</span>
        </div>
        <div className="flex items-center space-x-6">
          <a
            href="https://forms.gle/ag3Ct7zBXK94Eu1XA"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 text-gray-600 hover:text-yellow-600 transition group"
            aria-label="Contact Us"
          >
            <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium">Contact Us</span>
          </a>
          <a href="https://github.com/dhairye/Charitap" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-black transition" aria-label="GitHub">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.84 1.236 1.84 1.236 1.07 1.834 2.809 1.304 3.495.997.108-.775.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.468-2.381 1.236-3.221-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.3 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.289-1.552 3.295-1.23 3.295-1.23.653 1.653.242 2.873.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.61-2.803 5.625-5.475 5.921.43.372.823 1.102.823 2.222v3.293c0 .322.218.694.825.576C20.565 21.796 24 17.297 24 12c0-6.63-5.37-12-12-12z" /></svg>
          </a>
        </div>
      </div>
      <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-4 text-gray-500 text-sm">
        <span>&copy; {new Date().getFullYear()} Charitap. All rights reserved.</span>
        <span className="hidden md:inline-block text-gray-300">|</span>
        <a href="/privacy" className="hover:text-gray-800 transition-colors">Privacy Policy</a>
      </div>
    </footer>
  );
} 