import React, { useEffect, useState } from 'react';

const CollapsibleSection = ({ 
  title, 
  children, 
  defaultOpen = false,
  className = '',
  icon,
  persistKey,
  ...props 
}) => {
  const storageKey = persistKey ? `collapsible:${persistKey}` : null;
  const [isOpen, setIsOpen] = useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved === 'true' || saved === 'false') return saved === 'true';
      } catch (_) {}
    }
    return defaultOpen;
  });

  useEffect(() => {
    if (storageKey) {
      try { localStorage.setItem(storageKey, String(isOpen)); } catch (_) {}
    }
  }, [isOpen, storageKey]);

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`} {...props}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors duration-200 rounded-t-xl"
      >
        <div className="flex items-center space-x-3">
          {icon && (
            <div className="text-gray-500">
              {icon}
            </div>
          )}
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-6 pt-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection; 