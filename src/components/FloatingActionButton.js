import React, { useState } from 'react';
import RippleButton from './RippleButton';

const FloatingActionButton = ({ 
  icon, 
  onClick, 
  className = '', 
  size = 'large',
  color = 'primary',
  tooltip = '',
  ...props 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const sizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-14 h-14',
    large: 'w-16 h-16'
  };

  const colorClasses = {
    primary: 'bg-yellow-400 hover:bg-yellow-500 text-black',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    success: 'bg-green-500 hover:bg-green-600 text-white',
    danger: 'bg-red-500 hover:bg-red-600 text-white'
  };

  return (
    <div className="relative">
      <RippleButton
        className={`
          fixed bottom-6 right-6 z-50 rounded-full shadow-lg 
          transition-all duration-300 transform hover:scale-110 
          ${sizeClasses[size]} ${colorClasses[color]} ${className}
        `}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        <div className="flex items-center justify-center w-full h-full">
          {icon}
        </div>
      </RippleButton>
      
      {tooltip && isHovered && (
        <div className="absolute bottom-20 right-0 bg-black text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap z-50 animate-fade-in">
          {tooltip}
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
        </div>
      )}
    </div>
  );
};

export default FloatingActionButton; 