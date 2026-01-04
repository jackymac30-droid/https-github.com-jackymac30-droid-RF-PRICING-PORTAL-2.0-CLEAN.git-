import { useState, useEffect, useCallback } from 'react';
import { fetchWeeks, fetchCurrentOpenWeek } from '../utils/database';
import { logger } from '../utils/logger';
import type { Week } from '../types';

export function useWeekData() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [currentWeek, setCurrentWeek] = useState<Week | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadWeeks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const weeksData = await fetchWeeks();
      setWeeks(weeksData);
      
      // Try to get current open week
      const openWeek = await fetchCurrentOpenWeek();
      if (openWeek) {
        setCurrentWeek(openWeek);
      } else if (weeksData.length > 0) {
        // Fallback to first week if no open week
        setCurrentWeek(weeksData[0]);
      }
    } catch (err) {
      logger.error('Error loading weeks:', err);
      setError(err instanceof Error ? err : new Error('Failed to load weeks'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeeks();
  }, [loadWeeks]);

  return {
    weeks,
    currentWeek,
    loading,
    error,
    reload: loadWeeks,
    setCurrentWeek,
  };
}

