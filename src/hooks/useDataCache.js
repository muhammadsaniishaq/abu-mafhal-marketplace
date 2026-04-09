import { useState, useEffect, useCallback } from 'react';

/**
 * useDataCache - Stale-While-Revalidate (SWR) Hook
 * @param {string} key - The unique localStorage key for caching
 * @param {Function} fetcher - The async function to fetch fresh data
 * @param {any} initialValue - Default structure if no cache exists
 */
export function useDataCache(key, fetcher, initialValue) {
    const [data, setData] = useState(() => {
        // 🚀 Stage 1: Load from Stale Cache Immediately
        try {
            const cached = localStorage.getItem(`cache_${key}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                // Return cached data immediately if less than 24 hours old
                // (or just return it and let Stage 2 revalidate)
                return parsed.value;
            }
        } catch (e) {
            console.error(`Cache read failed for ${key}:`, e);
        }
        return initialValue;
    });
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const revalidate = useCallback(async () => {
        setLoading(true);
        try {
            // 🚀 Stage 2: Fetch Fresh Data in Background
            const freshData = await fetcher();
            if (freshData) {
                setData(freshData);
                // Update Cache
                localStorage.setItem(`cache_${key}`, JSON.stringify({
                    value: freshData,
                    timestamp: Date.now()
                }));
            }
            setError(null);
        } catch (err) {
            console.error(`Revalidation failed for ${key}:`, err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [key, fetcher]);

    useEffect(() => {
        revalidate();
    }, [revalidate]);

    return { data, loading, error, revalidate };
}
