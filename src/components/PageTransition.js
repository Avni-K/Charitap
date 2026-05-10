import React from 'react';
import { useLocation } from 'react-router-dom';

const PageTransition = ({ children }) => {
  const location = useLocation();

  return (
    <div
      key={location.pathname}
      className="animate-fade-in-up"
      style={{
        animationDuration: '0.3s',
        animationFillMode: 'both',
      }}
    >
      {children}
    </div>
  );
};

export default PageTransition; 