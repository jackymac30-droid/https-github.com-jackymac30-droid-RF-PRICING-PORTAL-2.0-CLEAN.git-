import { useState, useEffect, useCallback } from 'react';
import { fetchQuotesWithDetails } from '../utils/database';
import { logger } from '../utils/logger';
import type { QuoteWithDetails } from '../types';

export function useQuotesData(weekId: string | null, supplierId?: string | null) {
  const [quotes, setQuotes] = useState<QuoteWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadQuotes = useCallback(async () => {
    if (!weekId) {
      setQuotes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const quotesData = await fetchQuotesWithDetails(weekId, supplierId || undefined);
      setQuotes(quotesData);
    } catch (err) {
      logger.error('Error loading quotes:', err);
      setError(err instanceof Error ? err : new Error('Failed to load quotes'));
    } finally {
      setLoading(false);
    }
  }, [weekId, supplierId]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  return {
    quotes,
    loading,
    error,
    reload: loadQuotes,
  };
}

