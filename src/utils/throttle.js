/**
 * Throttle utility for performance optimization
 * Limits function execution frequency
 */

/**
 * Throttle function - ensures function is called at most once per specified time period
 * @param {Function} func - Function to throttle
 * @param {number} delay - Minimum time between calls in milliseconds
 * @returns {Function} - Throttled function
 */
export const throttle = (func, delay = 300) => {
    let lastCall = 0;
    let timeoutId = null;

    return function throttled(...args) {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall;

        // Clear any pending timeout
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }

        if (timeSinceLastCall >= delay) {
            // Enough time has passed, execute immediately
            lastCall = now;
            return func.apply(this, args);
        } else {
            // Schedule execution for later
            return new Promise((resolve) => {
                timeoutId = setTimeout(() => {
                    lastCall = Date.now();
                    resolve(func.apply(this, args));
                    timeoutId = null;
                }, delay - timeSinceLastCall);
            });
        }
    };
};

/**
 * Debounce function - delays execution until after wait period of inactivity
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export const debounce = (func, wait = 300) => {
    let timeoutId = null;

    return function debounced(...args) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        return new Promise((resolve) => {
            timeoutId = setTimeout(() => {
                resolve(func.apply(this, args));
                timeoutId = null;
            }, wait);
        });
    };
};

/**
 * Rate limiter for API calls
 * Prevents too many requests in a given time window
 */
export class RateLimiter {
    constructor(maxCalls = 10, timeWindow = 1000) {
        this.maxCalls = maxCalls;
        this.timeWindow = timeWindow;
        this.calls = [];
    }

    async execute(func) {
        const now = Date.now();

        // Remove calls outside the time window
        this.calls = this.calls.filter(time => now - time < this.timeWindow);

        if (this.calls.length >= this.maxCalls) {
            // Wait until oldest call expires
            const oldestCall = this.calls[0];
            const waitTime = this.timeWindow - (now - oldestCall);

            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            // Re-check after waiting
            this.calls = this.calls.filter(time => Date.now() - time < this.timeWindow);
        }

        this.calls.push(Date.now());
        return func();
    }
}

/**
 * Throttled API call wrapper
 * Use this to wrap API calls that shouldn't fire too frequently
 */
export const createThrottledAPI = (apiFunction, delay = 300) => {
    const throttledFn = throttle(apiFunction, delay);
    return throttledFn;
};

/**
 * Batch API calls - collects multiple calls and executes them together
 */
export class APIBatcher {
    constructor(batchFunction, delay = 100, maxBatchSize = 10) {
        this.batchFunction = batchFunction;
        this.delay = delay;
        this.maxBatchSize = maxBatchSize;
        this.queue = [];
        this.timeoutId = null;
    }

    add(item) {
        return new Promise((resolve, reject) => {
            this.queue.push({ item, resolve, reject });

            if (this.queue.length >= this.maxBatchSize) {
                // Execute immediately if batch is full
                this.flush();
            } else if (!this.timeoutId) {
                // Schedule batch execution
                this.timeoutId = setTimeout(() => this.flush(), this.delay);
            }
        });
    }

    async flush() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        if (this.queue.length === 0) return;

        const batch = this.queue.splice(0, this.queue.length);
        const items = batch.map(b => b.item);

        try {
            const results = await this.batchFunction(items);

            batch.forEach((b, index) => {
                b.resolve(results[index]);
            });
        } catch (error) {
            batch.forEach(b => b.reject(error));
        }
    }
}

export default {
    throttle,
    debounce,
    RateLimiter,
    createThrottledAPI,
    APIBatcher
};
