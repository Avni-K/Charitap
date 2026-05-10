import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for animating numbers with easing
 * Usage: const value = useCountUp(finalValue, duration);
 */
export function useCountUp(end, duration = 2000, start = 0) {
    const [count, setCount] = useState(start);
    const startTimeRef = useRef(null);
    const frameRef = useRef(null);

    useEffect(() => {
        // Reset animation when end value changes
        startTimeRef.current = null;
        setCount(start);

        const animate = (timestamp) => {
            if (!startTimeRef.current) {
                startTimeRef.current = timestamp;
            }

            const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);

            // Easing function (ease-out-cubic)
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            const currentCount = start + (end - start) * easeProgress;
            setCount(currentCount);

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(animate);
            }
        };

        if (end !== start) {
            frameRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, [end, duration, start]);

    return count;
}

/**
 * Format counter value for display
 */
export function formatCounterValue(value, type = 'currency') {
    if (type === 'currency') {
        return `$${value.toFixed(2)}`;
    }
    return Math.floor(value).toString();
}
