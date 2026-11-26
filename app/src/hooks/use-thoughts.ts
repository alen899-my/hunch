import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as thoughtsService from '@/services/thoughts.service';
import type { Thought, DaySummary, ThoughtCategory } from '@/services/thoughts.service';
import { useAuth } from './use-auth';
import {
  applyOptimisticMentionInStore,
  replaceOptimisticMentionThoughtInStore,
  removeOptimisticMentionThoughtsInStore,
  waitForPendingPeopleCreations,
} from './use-people';

export type StreamThought = Thought & { clientKey?: string };

const getTodayDate = () => new Date().toISOString().split('T')[0];

const STORAGE_DAYS_PREFIX = '@hunch_days_cache_v1_';
const STORAGE_STREAM_PREFIX = '@hunch_stream_cache_v1_';
const SILENT_REFETCH_THROTTLE_MS = 4000;

interface DaysStoreState {
  days: DaySummary[];
  loading: boolean;
  error: string | null;
  tokenKey: string | null;
  hydrated: boolean;
  lastFetchAt: number;
  mutationVersion: number;
  pendingMutations: number;
}

interface DayStreamStoreState {
  thoughts: StreamThought[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  tokenKey: string | null;
  hydrated: boolean;
  lastFetchAt: number;
  mutationVersion: number;
  pendingMutations: number;
}

export interface DaysSnapshot {
  days: DaySummary[];
  loading: boolean;
  error: string | null;
}

export interface DayStreamSnapshot {
  thoughts: StreamThought[];
  loading: boolean;
  sending: boolean;
  error: string | null;
}

const EMPTY_DAYS_SNAPSHOT: DaysSnapshot = {
  days: [],
  loading: true,
  error: null,
};

const EMPTY_STREAM_SNAPSHOT: DayStreamSnapshot = {
  thoughts: [],
  loading: true,
  sending: false,
  error: null,
};

const _daysState: DaysStoreState = {
  days: [],
  loading: true,
  error: null,
  tokenKey: '__uninitialized__',
  hydrated: false,
  lastFetchAt: 0,
  mutationVersion: 0,
  pendingMutations: 0,
};

let _daysSnapshot: DaysSnapshot = EMPTY_DAYS_SNAPSHOT;
const _streamStates = new Map<string, DayStreamStoreState>();
const _streamSnapshots = new Map<string, DayStreamSnapshot>();
const _daysListeners = new Set<() => void>();
const _streamListeners = new Map<string, Set<() => void>>();

const getTokenBucket = (tokenKey: string | null) => tokenKey || 'guest';

function getDaysSnapshot(tokenKey: string | null): DaysSnapshot {
  if (_daysState.tokenKey !== tokenKey) {
    return EMPTY_DAYS_SNAPSHOT;
  }
  return _daysSnapshot;
}

function getStreamSnapshot(dayDate: string, tokenKey: string | null): DayStreamSnapshot {
  const state = _streamStates.get(dayDate);
  if (!state || state.tokenKey !== tokenKey) {
    return EMPTY_STREAM_SNAPSHOT;
  }
  return _streamSnapshots.get(dayDate) || EMPTY_STREAM_SNAPSHOT;
}

function notifyDays() {
  _daysSnapshot = {
    days: _daysState.days,
    loading: _daysState.loading,
    error: _daysState.error,
  };
  _daysListeners.forEach((fn) => fn());
}

function notifyStream(dayDate: string) {
  const state = _streamStates.get(dayDate);
  if (state) {
    _streamSnapshots.set(dayDate, {
      thoughts: state.thoughts,
      loading: state.loading,
      sending: state.sending,
      error: state.error,
    });
  } else {
    _streamSnapshots.delete(dayDate);
  }
  _streamListeners.get(dayDate)?.forEach((fn) => fn());
}

function resetThoughtStoresForToken(tokenKey: string | null) {
  _daysState.days = [];
  _daysState.loading = true;
  _daysState.error = null;
  _daysState.tokenKey = tokenKey;
  _daysState.hydrated = false;
  _daysState.lastFetchAt = 0;
  _daysState.mutationVersion += 1;
  _daysState.pendingMutations = 0;
  _streamStates.clear();
  _streamSnapshots.clear();
  notifyDays();
  _streamListeners.forEach((listeners) => listeners.forEach((fn) => fn()));
}

function getOrCreateStreamState(dayDate: string, tokenKey: string | null): DayStreamStoreState {
  const existing = _streamStates.get(dayDate);
  if (existing && existing.tokenKey === tokenKey) {
    return existing;
  }
  const fresh: DayStreamStoreState = {
    thoughts: [],
    loading: true,
    sending: false,
    error: null,
    tokenKey,
    hydrated: false,
    lastFetchAt: 0,
    mutationVersion: 0,
    pendingMutations: 0,
  };
  _streamStates.set(dayDate, fresh);
  return fresh;
}

async function persistDaysCache(tokenKey: string | null, days: DaySummary[]) {
  try {
    await AsyncStorage.setItem(
      `${STORAGE_DAYS_PREFIX}${getTokenBucket(tokenKey)}`,
      JSON.stringify(days)
    );
  } catch {
    // ignore storage errors
  }
}

async function persistStreamCache(
  tokenKey: string | null,
  dayDate: string,
  thoughts: StreamThought[]
) {
  try {
    const clean = thoughts.filter((t) => !t.id.startsWith('temp_'));
    await AsyncStorage.setItem(
      `${STORAGE_STREAM_PREFIX}${getTokenBucket(tokenKey)}_${dayDate}`,
      JSON.stringify(clean)
    );
  } catch {
    // ignore storage errors
  }
}

async function hydrateDaysFromStorage(tokenKey: string | null) {
  if (_daysState.tokenKey !== tokenKey) {
    resetThoughtStoresForToken(tokenKey);
  }
  if (_daysState.hydrated) return;
  _daysState.hydrated = true;

  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_DAYS_PREFIX}${getTokenBucket(tokenKey)}`);
    if (raw && _daysState.tokenKey === tokenKey && _daysState.days.length === 0) {
      const parsed = JSON.parse(raw) as DaySummary[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        _daysState.days = parsed;
        _daysState.loading = false;
        notifyDays();
      }
    }
  } catch {
    // ignore
  }
}

async function hydrateStreamFromStorage(tokenKey: string | null, dayDate: string) {
  const state = getOrCreateStreamState(dayDate, tokenKey);
  if (state.hydrated) return;
  state.hydrated = true;

  try {
    const raw = await AsyncStorage.getItem(
      `${STORAGE_STREAM_PREFIX}${getTokenBucket(tokenKey)}_${dayDate}`
    );
    if (raw) {
      const parsed = JSON.parse(raw) as StreamThought[];
      const cur = getOrCreateStreamState(dayDate, tokenKey);
      if (Array.isArray(parsed) && cur.thoughts.length === 0) {
        cur.thoughts = parsed;
        cur.loading = false;
        notifyStream(dayDate);
      }
    }
  } catch {
    // ignore
  }
}

function syncDaySummaryFromStream(dayDate: string, streamThoughts: StreamThought[]) {
  _daysState.mutationVersion += 1;
  const count = streamThoughts.length;
  const existingIdx = _daysState.days.findIndex((d) => d.day_date === dayDate);

  if (count === 0) {
    if (existingIdx !== -1) {
      _daysState.days = _daysState.days.filter((d) => d.day_date !== dayDate);
      notifyDays();
      persistDaysCache(_daysState.tokenKey, _daysState.days);
    }
    return;
  }

  const latest = streamThoughts[streamThoughts.length - 1];
  const nextSummary: DaySummary = {
    day_date: dayDate,
    thought_count: count,
    last_updated: latest.created_at,
    latest_preview: latest.content,
    latest_category: latest.category,
  };

  if (existingIdx !== -1) {
    const nextDays = [..._daysState.days];
    nextDays[existingIdx] = nextSummary;
    _daysState.days = nextDays;
  } else {
    _daysState.days = [nextSummary, ..._daysState.days].sort((a, b) =>
      b.day_date.localeCompare(a.day_date)
    );
  }
  notifyDays();
  persistDaysCache(_daysState.tokenKey, _daysState.days);
}

async function fetchDaysInternal(token: string | null, isSilent = false) {
  const tokenKey = token ?? null;
  if (_daysState.tokenKey !== tokenKey) {
    resetThoughtStoresForToken(tokenKey);
  }
  await hydrateDaysFromStorage(tokenKey);

  const now = Date.now();
  if (
    isSilent &&
    _daysState.lastFetchAt > 0 &&
    now - _daysState.lastFetchAt < SILENT_REFETCH_THROTTLE_MS &&
    _daysState.pendingMutations === 0
  ) {
    return;
  }

  if (!isSilent && _daysState.days.length === 0) {
    _daysState.loading = true;
    notifyDays();
  }
  _daysState.error = null;

  const startVersion = _daysState.mutationVersion;
  try {
    const res = await thoughtsService.getDays(token);
    if (_daysState.tokenKey !== tokenKey) return;
    if (_daysState.mutationVersion !== startVersion || _daysState.pendingMutations > 0) {
      return;
    }

    if (res.success && res.data?.days) {
      _daysState.days = res.data.days;
      _daysState.lastFetchAt = Date.now();
      notifyDays();
      persistDaysCache(tokenKey, res.data.days);
    }
  } catch {
    if (_daysState.days.length === 0) {
      _daysState.error = 'Could not load days';
    }
  } finally {
    _daysState.loading = false;
    notifyDays();
  }
}

export function useThoughts() {
  const { token } = useAuth();
  const tokenKey = token ?? null;
  const [snapshot, setSnapshot] = useState<DaysSnapshot>(() => getDaysSnapshot(tokenKey));

  useEffect(() => {
    setSnapshot(getDaysSnapshot(tokenKey));
    const listener = () => setSnapshot(getDaysSnapshot(tokenKey));
    _daysListeners.add(listener);
    return () => {
      _daysListeners.delete(listener);
    };
  }, [tokenKey]);

  useEffect(() => {
    fetchDaysInternal(
      token ?? null,
      _daysState.days.length > 0 && _daysState.tokenKey === tokenKey
    );
  }, [token, tokenKey]);

  const fetchDays = useCallback(
    async (isSilent = false) => {
      await fetchDaysInternal(token ?? null, isSilent);
    },
    [token]
  );

  return {
    days: snapshot.days,
    loading: snapshot.loading,
    error: snapshot.error,
    fetchDays,
  };
}

export function useDayStream(dayDate: string) {
  const { token } = useAuth();
  const tokenKey = token ?? null;
  const date = dayDate || getTodayDate();
  const [snapshot, setSnapshot] = useState<DayStreamSnapshot>(() =>
    getStreamSnapshot(date, tokenKey)
  );

  useEffect(() => {
    setSnapshot(getStreamSnapshot(date, tokenKey));
    const listener = () => setSnapshot(getStreamSnapshot(date, tokenKey));
    let set = _streamListeners.get(date);
    if (!set) {
      set = new Set();
      _streamListeners.set(date, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }, [date, tokenKey]);

  const fetchThoughts = useCallback(
    async (isSilent = false) => {
      if (_daysState.tokenKey !== tokenKey) {
        resetThoughtStoresForToken(tokenKey);
      }
      const state = getOrCreateStreamState(date, tokenKey);
      await hydrateStreamFromStorage(tokenKey, date);

      const now = Date.now();
      if (
        isSilent &&
        state.lastFetchAt > 0 &&
        now - state.lastFetchAt < SILENT_REFETCH_THROTTLE_MS &&
        state.pendingMutations === 0
      ) {
        return;
      }

      if (!isSilent && state.thoughts.length === 0) {
        state.loading = true;
        notifyStream(date);
      }
      state.error = null;

      const startVersion = state.mutationVersion;
      try {
        const res = await thoughtsService.getDayThoughts(date, token);
        const cur = getOrCreateStreamState(date, tokenKey);
        if (cur.mutationVersion !== startVersion || cur.pendingMutations > 0) {
          return;
        }

        if (res.success && res.data?.thoughts) {
          cur.thoughts = res.data.thoughts;
          cur.lastFetchAt = Date.now();
          persistStreamCache(tokenKey, date, res.data.thoughts);
        }
      } catch {
        const cur = getOrCreateStreamState(date, tokenKey);
        if (cur.thoughts.length === 0) {
          cur.error = 'Could not load thoughts';
        }
      } finally {
        const cur = getOrCreateStreamState(date, tokenKey);
        cur.loading = false;
        notifyStream(date);
      }
    },
    [date, token, tokenKey]
  );

  useEffect(() => {
    const state = getOrCreateStreamState(date, tokenKey);
    fetchThoughts(state.thoughts.length > 0 && state.lastFetchAt > 0);
  }, [date, tokenKey, fetchThoughts]);

  // Send a new thought: updates chat, day summary, AND mentioned people instantly in 0ms
  const addThought = useCallback(
    async (
      content: string,
      category: ThoughtCategory = 'thinking',
      mentionedPersonIds?: string[],
      clientKeyOverride?: string
    ) => {
      const trimmed = content.trim();
      if (!trimmed) return null;

      const state = getOrCreateStreamState(date, tokenKey);
      const tempId = clientKeyOverride || `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const nowIso = new Date().toISOString();

      const optimisticThought: StreamThought = {
        id: tempId,
        clientKey: tempId,
        user_id: '',
        day_date: date,
        content: trimmed,
        category,
        created_at: nowIso,
      };

      // 1. Instant 0ms reactive update across stream, days list, and people mentions
      state.mutationVersion += 1;
      state.pendingMutations += 1;
      _daysState.pendingMutations += 1;
      state.thoughts = [...state.thoughts, optimisticThought];
      state.loading = false;
      notifyStream(date);

      syncDaySummaryFromStream(date, state.thoughts);
      if (trimmed.includes('@')) {
        applyOptimisticMentionInStore(optimisticThought, mentionedPersonIds);
      }

      // 2. Persist to server in background without blocking UI
      (async () => {
        try {
          const resolvedMentionIds =
            trimmed.includes('@')
              ? await waitForPendingPeopleCreations(mentionedPersonIds || [])
              : undefined;

          const res = await thoughtsService.createThought(
            {
              dayDate: date,
              content: trimmed,
              category,
              ...(resolvedMentionIds && resolvedMentionIds.length > 0
                ? { mentionedPersonIds: resolvedMentionIds }
                : {}),
            },
            token
          );

          if (!res.success || !res.data?.thought) {
            throw new Error(res.message || 'Failed to save thought');
          }

          const savedThought: StreamThought = {
            ...res.data.thought,
            clientKey: tempId, // Keep React key identical to prevent flicker/re-animation
          };

          const cur = getOrCreateStreamState(date, tokenKey);
          const idx = cur.thoughts.findIndex((t) => t.id === tempId || t.clientKey === tempId);
          if (idx !== -1) {
            const next = [...cur.thoughts];
            next[idx] = savedThought;
            cur.thoughts = next;
          } else {
            cur.thoughts = [...cur.thoughts, savedThought];
          }
          cur.lastFetchAt = Date.now();
          notifyStream(date);
          persistStreamCache(tokenKey, date, cur.thoughts);

          if (trimmed.includes('@')) {
            replaceOptimisticMentionThoughtInStore(tempId, savedThought);
          }
        } catch (err: any) {
          const cur = getOrCreateStreamState(date, tokenKey);
          cur.thoughts = cur.thoughts.filter((t) => t.id !== tempId && t.clientKey !== tempId);
          cur.error = err?.message || 'Failed to save thought';
          notifyStream(date);
          syncDaySummaryFromStream(date, cur.thoughts);
          if (trimmed.includes('@')) {
            removeOptimisticMentionThoughtsInStore([tempId]);
          }
          Alert.alert('Could not save thought', 'Please check your connection and try again.');
        } finally {
          const cur = getOrCreateStreamState(date, tokenKey);
          cur.pendingMutations = Math.max(0, cur.pendingMutations - 1);
          _daysState.pendingMutations = Math.max(0, _daysState.pendingMutations - 1);
        }
      })();

      return optimisticThought;
    },
    [date, token, tokenKey]
  );

  // Remove a single thought instantly across stream, days list, and people mentions
  const removeThought = useCallback(
    async (id: string) => {
      const state = getOrCreateStreamState(date, tokenKey);
      state.mutationVersion += 1;
      state.pendingMutations += 1;
      _daysState.pendingMutations += 1;

      state.thoughts = state.thoughts.filter((t) => t.id !== id);
      notifyStream(date);
      syncDaySummaryFromStream(date, state.thoughts);
      removeOptimisticMentionThoughtsInStore([id]);
      persistStreamCache(tokenKey, date, state.thoughts);

      if (!id.startsWith('temp_')) {
        thoughtsService
          .deleteThought(id, token)
          .catch(() => {})
          .finally(() => {
            state.pendingMutations = Math.max(0, state.pendingMutations - 1);
            _daysState.pendingMutations = Math.max(0, _daysState.pendingMutations - 1);
          });
      } else {
        state.pendingMutations = Math.max(0, state.pendingMutations - 1);
        _daysState.pendingMutations = Math.max(0, _daysState.pendingMutations - 1);
      }
    },
    [date, token, tokenKey]
  );

  // Remove multiple thoughts instantly across stream, days list, and people mentions
  const removeThoughts = useCallback(
    async (ids: string[]) => {
      const idSet = new Set(ids);
      const state = getOrCreateStreamState(date, tokenKey);
      state.mutationVersion += 1;
      state.pendingMutations += 1;
      _daysState.pendingMutations += 1;

      state.thoughts = state.thoughts.filter((t) => !idSet.has(t.id));
      notifyStream(date);
      syncDaySummaryFromStream(date, state.thoughts);
      removeOptimisticMentionThoughtsInStore(ids);
      persistStreamCache(tokenKey, date, state.thoughts);

      const serverIds = ids.filter((id) => !id.startsWith('temp_'));
      if (serverIds.length > 0) {
        thoughtsService
          .bulkDeleteThoughts(serverIds, token)
          .catch(() => {})
          .finally(() => {
            state.pendingMutations = Math.max(0, state.pendingMutations - 1);
            _daysState.pendingMutations = Math.max(0, _daysState.pendingMutations - 1);
          });
      } else {
        state.pendingMutations = Math.max(0, state.pendingMutations - 1);
        _daysState.pendingMutations = Math.max(0, _daysState.pendingMutations - 1);
      }
    },
    [date, token, tokenKey]
  );

  return {
    date,
    thoughts: snapshot.thoughts,
    loading: snapshot.loading,
    sending: snapshot.sending,
    error: snapshot.error,
    fetchThoughts,
    addThought,
    removeThought,
    removeThoughts,
  };
}
