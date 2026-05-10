import React from 'react';

/**
 * Skeleton Loading Component
 * Provides smooth placeholder UI while content loads
 */
export default function Skeleton({ variant = 'text', width, height, className = '', count = 1 }) {
    const baseClass = 'animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] rounded';

    const variants = {
        text: 'h-4 w-full rounded',
        title: 'h-6 w-3/4 rounded',
        circle: 'rounded-full',
        rect: 'rounded-lg',
        card: 'h-48 w-full rounded-xl'
    };

    const variantClass = variants[variant] || variants.text;

    const style = {
        width: width || undefined,
        height: height || undefined,
        animation: 'shimmer 1.5s infinite'
    };

    return (
        <>
            <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className={`${baseClass} ${variantClass} ${className}`}
                    style={style}
                />
            ))}
        </>
    );
}

// Pre-configured skeleton layouts
export function SkeletonCard() {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <Skeleton variant="title" className="mb-4" />
            <Skeleton variant="text" count={3} className="mb-2" />
        </div>
    );
}

export function SkeletonStat() {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <Skeleton variant="text" width="60%" className="mb-2" />
            <Skeleton variant="title" width="40%" />
        </div>
    );
}

export function SkeletonActivity() {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start space-x-4">
                <Skeleton variant="circle" width="40px" height="40px" />
                <div className="flex-1">
                    <Skeleton variant="text" width="70%" className="mb-2" />
                    <Skeleton variant="text" width="50%" />
                </div>
                <Skeleton variant="text" width="60px" />
            </div>
        </div>
    );
}
