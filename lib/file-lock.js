import path from 'node:path';

/**
 * FileLockManager - Async Mutex Queue per normalized file path
 * Prevents race conditions during parallel AI tool calls
 */
export class FileLockManager {
    constructor() {
        this.locks = new Map();
    }

    /**
     * Acquire lock for a file path and execute action
     * @template T
     * @param {string} filePath
     * @param {() => Promise<T>} action
     * @returns {Promise<T>}
     */
    async withLock(filePath, action) {
        const key = path.normalize(path.resolve(filePath)).toLowerCase();
        
        let lockPromise = this.locks.get(key) || Promise.resolve();

        // Chain the new action to the current lock queue
        const nextPromise = lockPromise
            .catch(() => {}) // Don't let previous failures block future locks
            .then(async () => {
                return await action();
            });

        this.locks.set(key, nextPromise);

        try {
            return await nextPromise;
        } finally {
            // Clean up map entry when queue empties
            if (this.locks.get(key) === nextPromise) {
                this.locks.delete(key);
            }
        }
    }
}
