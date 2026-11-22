import { useState, useCallback, useEffect } from 'react';
import * as thoughtsService from '@/services/thoughts.service';
import type { Thought, DaySummary, ThoughtCategory } from '@/services/thoughts.service';
import { useAuth } from './use-auth';

const getTodayDate = () => new Date().toISOString().split('T')[0];

// In-memory cache for instant server-side cached loading (0ms latency on return)
const _daysSummaryCache: { data: DaySummary[]; timestamp: number } = {
  data: [],
  timestamp: 0,
};
const _dayStreamCache = new Map<string, Thought[]>();

export function useThoughts() {
  const { token } = useAuth();
  const [days, setDays] = useState<DaySummary[]>(_daysSummaryCache.data);
  const [loading, setLoading] = useState(_daysSummaryCache.data.length === 0);
  const [error, setError] = useState<string | null>(null);

  // Fetch all days
  const fetchDays = useCallback(async () => {
    // Only show loading indicator if we don't already have cached data
    if (_daysSummaryCache.data.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await thoughtsService.getDays(token);
      if (res.success && res.data?.days) {
        _daysSummaryCache.data = res.data.days;
        _daysSummaryCache.timestamp = Date.now();
        setDays(res.data.days);
      } else if (_daysSummaryCache.data.length === 0) {
        setDays([]);
      }
    } catch {
      if (_daysSummaryCache.data.length === 0) {
        setDays([]);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDays();
  }, [fetchDays]);

  return {
    days,
    loading,
    error,
    fetchDays,
  };
}

export function useDayStream(dayDate: string) {
  const { token } = useAuth();
  const date = dayDate || getTodayDate();
  
  // Instant load from memory cache if previously viewed or stored
  const cached = _dayStreamCache.get(date) || [];
  const [thoughts, setThoughts] = useState<Thought[]>(cached);
  const [loading, setLoading] = useState(cached.length === 0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load thoughts for this day
  const fetchThoughts = useCallback(async (isSilent = false) => {
    const hasCache = _dayStreamCache.has(date);
    if (!hasCache && !isSilent) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await thoughtsService.getDayThoughts(date, token);
      if (res.success && res.data?.thoughts) {
        _dayStreamCache.set(date, res.data.thoughts);
        setThoughts(res.data.thoughts);
      } else if (!hasCache) {
        setThoughts([]);
      }
    } catch {
      if (!hasCache) {
        setThoughts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [date, token]);

  useEffect(() => {
    // If date changed or hook mounted, load cached immediately then fetch fresh
    if (_dayStreamCache.has(date)) {
      setThoughts(_dayStreamCache.get(date)!);
      setLoading(false);
      fetchThoughts(true); // silent background revalidation
    } else {
      fetchThoughts(false);
    }
  }, [date, fetchThoughts]);

  // Send a new thought (saves to database first, then renders confirmed chat)
  const addThought = useCallback(
    async (content: string, category: ThoughtCategory = 'thinking') => {
      if (!content.trim()) return null;

      setSending(true);
      setError(null);

      try {
        const res = await thoughtsService.createThought(
          { dayDate: date, content: content.trim(), category },
          token
        );
        if (res.success && res.data?.thought) {
          const savedThought = res.data.thought;
          setThoughts((prev) => {
            const next = [...prev, savedThought];
            _dayStreamCache.set(date, next);
            return next;
          });
          return savedThought;
        } else {
          throw new Error(res.message || 'Failed to save thought');
        }
      } catch (err: any) {
        const msg = err?.message || 'Failed to save thought';
        setError(msg);
        throw err;
      } finally {
        setSending(false);
      }
    },
    [date, token]
  );

  // Remove a single thought
  const removeThought = useCallback(
    async (id: string) => {
      setThoughts((prev) => {
        const next = prev.filter((t) => t.id !== id);
        _dayStreamCache.set(date, next);
        return next;
      });
      try {
        await thoughtsService.deleteThought(id, token);
      } catch {
        // local delete maintained
      }
    },
    [date, token]
  );

  // Remove multiple thoughts
  const removeThoughts = useCallback(
    async (ids: string[]) => {
      const idSet = new Set(ids);
      setThoughts((prev) => {
        const next = prev.filter((t) => !idSet.has(t.id));
        _dayStreamCache.set(date, next);
        return next;
      });
      try {
        await thoughtsService.bulkDeleteThoughts(ids, token);
      } catch {
        // local delete maintained
      }
    },
    [date, token]
  );

  return {
    date,
    thoughts,
    loading,
    sending,
    error,
    fetchThoughts,
    addThought,
    removeThought,
    removeThoughts,
  };
}
