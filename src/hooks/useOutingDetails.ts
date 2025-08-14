// src/hooks/useOutingDetails.ts
import { useState, useEffect, useCallback } from 'react';
import { DetailedOuting } from '@/types/outing';
import { getOutingWithMembers } from '@/lib/notion/outings';

interface UseOutingDetailsResult {
  outing: DetailedOuting | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useOutingDetails(outingId: string | null): UseOutingDetailsResult {
  const [outing, setOuting] = useState<DetailedOuting | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOuting = useCallback(async () => {
    if (!outingId) {
      setOuting(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Fetching outing details for ID:', outingId);
      const detailedOuting = await getOutingWithMembers(outingId);
      
      if (detailedOuting) {
        setOuting(detailedOuting);
        console.log('✅ Successfully loaded outing details:', detailedOuting.properties.Name);
      } else {
        setError('Outing not found');
        setOuting(null);
      }
    } catch (err) {
      console.error('❌ Error fetching outing details:', err);
      setError('Failed to load outing details');
      setOuting(null);
    } finally {
      setLoading(false);
    }
  }, [outingId]);

  const refresh = useCallback(async () => {
    await fetchOuting();
  }, [fetchOuting]);

  useEffect(() => {
    fetchOuting();
  }, [fetchOuting]);

  return {
    outing,
    loading,
    error,
    refresh
  };
}
