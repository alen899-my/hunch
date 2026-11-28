import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as thoughtsService from '@/services/thoughts.service';
import type {
  Thought,
  DaySummary,
  ThoughtCategory,
  ThoughtMood,
  TagSummary,
  ThoughtsStats,
} from '@/services/thoughts.service';
import { extractHashtagsFromText } from '@/features/thoughts/utils/tags';
import { useAuth } from './use-auth';
import {
  applyOptimisticMentionInStore,
  replaceOptimisticMentionThoughtInStore,
  removeOptimisticMentionThoughtsInStore,
  waitForPendingPeopleCreations,
  upsertKnownPeopleInStore,
} from './use-people';
import {
  setLatestMoodInStore,
  resetMoodThemeForToken,
  applyInitialMoodStatsIfEmpty,
} from './use-mood-theme';

export type StreamThought = Thought & { clientKey?: string; pendingOffline?: boolean };

const getTodayDate = () => new Date().toISOString().split('T')[0];

const STORAGE_DAYS_PREFIX = '@hunch_days_cache_v1_';
const STORAGE_STREAM_PREFIX = '@hunch_stream_cache_v1_';
const STORAGE_STATS_PREFIX = '@hunch_stats_cache_v1_';
const STORAGE_TAGS_PREFIX = '@hunch_tags_cache_v1_';
const STORAGE_OFFLINE_QUEUE_PREFIX = '@hunch_offline_queue_v1_';
const SILENT_REFETCH_THROTTLE_MS = 4000;

interface QueuedThoughtItem {
  tempId: string;
  dayDate: string;
  content: string;
  category: ThoughtCategory;
  mood?: ThoughtMood | null;
  replyToId?: string | null;
  mentionedPersonIds?: string[];
  createdAt: string;
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

export interface StatsSnapshot {
  stats: ThoughtsStats | null;
  loading: boolean;
}

export interface TagsSnapshot {
  tags: TagSummary[];
  loading: boolean;
}

interface DaysStoreState extends DaysSnapshot {
  tokenKey: string | null;
  hydrated: boolean;
  lastFetchAt: number;
  mutationVersion: number;
  pendingMutations: number;
}

interface DayStreamStoreState extends DayStreamSnapshot {
  tokenKey: string | null;
  hydrated: boolean;
  lastFetchAt: number;
  mutationVersion: number;
  pendingMutations: number;
}

const EMPTY_DAYS_SNAPSHOT: DaysSnapshot = { days: [], loading: true, error: null };
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

let _statsSnapshot: StatsSnapshot = { stats: null, loading: true };
let _statsLastFetch = 0;
let _statsTokenKey: string | null = '__uninitialized__';
const _statsListeners = new Set<() => void>();

let _tagsSnapshot: TagsSnapshot = { tags: [], loading: true };
let _tagsLastFetch = 0;
let _tagsTokenKey: string | null = '__uninitialized__';
const _tagsListeners = new Set<() => void>();

let _flushingQueue = false;

const getTokenBucket = (tokenKey: string | null) => tokenKey || 'guest';

function getDaysSnapshot(tokenKey: string | null): DaysSnapshot {
  if (_daysState.tokenKey !== tokenKey) return EMPTY_DAYS_SNAPSHOT;
  return _daysSnapshot;
}

function getStreamSnapshot(dayDate: string, tokenKey: string | null): DayStreamSnapshot {
  const state = _streamStates.get(dayDate);
  if (!state || state.tokenKey !== tokenKey) return EMPTY_STREAM_SNAPSHOT;
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

function notifyStats() {
  _statsListeners.forEach((fn) => fn());
}

function notifyTags() {
  _tagsListeners.forEach((fn) => fn());
}

function applyStatsSnapshot(stats: ThoughtsStats, tokenKey: string | null) {
  _statsSnapshot = { stats, loading: false };
  _statsLastFetch = Date.now();
  notifyStats();
  setLatestMoodInStore(stats.latestMood ?? null, tokenKey);
  AsyncStorage.setItem(
    `${STORAGE_STATS_PREFIX}${getTokenBucket(tokenKey)}`,
    JSON.stringify(stats)
  ).catch(() => {});
}

async function refreshStatsMoodFromServer(token: string | null, tokenKey: string | null) {
  try {
    const res = await thoughtsService.getStats(token);
    if (res.success && res.data?.stats && _statsTokenKey === tokenKey) {
      applyStatsSnapshot(res.data.stats, tokenKey);
    }
  } catch {
    // ignore background stats sync errors
  }
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
  _statsSnapshot = { stats: null, loading: true };
  _statsLastFetch = 0;
  _statsTokenKey = tokenKey;
  _tagsSnapshot = { tags: [], loading: true };
  _tagsLastFetch = 0;
  _tagsTokenKey = tokenKey;
  notifyDays();
  notifyStats();
  notifyTags();
  _streamListeners.forEach((listeners) => listeners.forEach((fn) => fn()));
  resetMoodThemeForToken(tokenKey);
}

function getOrCreateStreamState(dayDate: string, tokenKey: string | null): DayStreamStoreState {
  const existing = _streamStates.get(dayDate);
  if (existing && existing.tokenKey === tokenKey) return existing;
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
  } catch {}
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
  } catch {}
}

async function enqueueOfflineThought(tokenKey: string | null, item: QueuedThoughtItem) {
  try {
    const key = `${STORAGE_OFFLINE_QUEUE_PREFIX}${getTokenBucket(tokenKey)}`;
    const raw = await AsyncStorage.getItem(key);
    const queue: QueuedThoughtItem[] = raw ? JSON.parse(raw) : [];
    queue.push(item);
    await AsyncStorage.setItem(key, JSON.stringify(queue));
  } catch {}
}

async function flushOfflineQueue(token: string | null) {
  if (_flushingQueue) return;
  const tokenKey = token ?? null;
  const key = `${STORAGE_OFFLINE_QUEUE_PREFIX}${getTokenBucket(tokenKey)}`;
  try {
    _flushingQueue = true;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return;
    const queue: QueuedThoughtItem[] = JSON.parse(raw);
    if (!Array.isArray(queue) || queue.length === 0) return;

    const remaining: QueuedThoughtItem[] = [];
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      try {
        const res = await thoughtsService.createThought(
          {
            dayDate: item.dayDate,
            content: item.content,
            category: item.category,
            mood: item.mood ?? null,
            replyToId: item.replyToId ?? null,
            mentionedPersonIds: item.mentionedPersonIds,
          },
          token
        );
        if (res.success && res.data?.thought) {
          const cur = getOrCreateStreamState(item.dayDate, tokenKey);
          const saved: StreamThought = { ...res.data.thought, clientKey: item.tempId };
          const idx = cur.thoughts.findIndex(
            (t) => t.id === item.tempId || t.clientKey === item.tempId
          );
          if (idx !== -1) {
            const next = [...cur.thoughts];
            next[idx] = saved;
            cur.thoughts = next;
          } else {
            cur.thoughts = [...cur.thoughts, saved];
          }
          notifyStream(item.dayDate);
          persistStreamCache(tokenKey, item.dayDate, cur.thoughts);
        } else {
          remaining.push(item);
        }
      } catch {
        remaining.push(...queue.slice(i));
        break;
      }
    }

    await AsyncStorage.setItem(key, JSON.stringify(remaining));
  } catch {
    // ignore
  } finally {
    _flushingQueue = false;
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
  } catch {}
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
  } catch {}
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

function bumpAnalyticsInvalidation() {
  _statsLastFetch = 0;
  _tagsLastFetch = 0;
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
    await flushOfflineQueue(token);
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

export function useThoughtsStats() {
  const { token } = useAuth();
  const tokenKey = token ?? null;
  const [snapshot, setSnapshot] = useState<StatsSnapshot>(() =>
    _statsTokenKey === tokenKey ? _statsSnapshot : { stats: null, loading: true }
  );

  useEffect(() => {
    if (_statsTokenKey === tokenKey) {
      setSnapshot(_statsSnapshot);
    }
    const listener = () => setSnapshot(_statsSnapshot);
    _statsListeners.add(listener);
    return () => {
      _statsListeners.delete(listener);
    };
  }, [tokenKey]);

  const fetchStats = useCallback(
    async (force = false) => {
      if (_statsTokenKey !== tokenKey) {
        _statsTokenKey = tokenKey;
        _statsSnapshot = { stats: null, loading: true };
        _statsLastFetch = 0;
        notifyStats();
      }
      if (!_statsSnapshot.stats) {
        try {
          const raw = await AsyncStorage.getItem(`${STORAGE_STATS_PREFIX}${getTokenBucket(tokenKey)}`);
          if (raw) {
            const parsedStats = JSON.parse(raw) as ThoughtsStats;
            _statsSnapshot = { stats: parsedStats, loading: false };
            notifyStats();
            if (parsedStats?.latestMood) {
              applyInitialMoodStatsIfEmpty(parsedStats.latestMood, tokenKey);
            }
          }
        } catch {}
      }

      if (!force && _statsLastFetch > 0 && Date.now() - _statsLastFetch < SILENT_REFETCH_THROTTLE_MS) {
        return;
      }

      try {
        const res = await thoughtsService.getStats(token);
        if (res.success && res.data?.stats) {
          applyStatsSnapshot(res.data.stats, tokenKey);
        }
      } catch {
        _statsSnapshot = { ..._statsSnapshot, loading: false };
        notifyStats();
      }
    },
    [token, tokenKey]
  );

  useEffect(() => {
    fetchStats(false);
  }, [fetchStats]);

  return {
    stats: snapshot.stats,
    loading: snapshot.loading,
    fetchStats,
  };
}

export function useTags() {
  const { token } = useAuth();
  const tokenKey = token ?? null;
  const [snapshot, setSnapshot] = useState<TagsSnapshot>(() =>
    _tagsTokenKey === tokenKey ? _tagsSnapshot : { tags: [], loading: true }
  );

  useEffect(() => {
    if (_tagsTokenKey === tokenKey) {
      setSnapshot(_tagsSnapshot);
    }
    const listener = () => setSnapshot(_tagsSnapshot);
    _tagsListeners.add(listener);
    return () => {
      _tagsListeners.delete(listener);
    };
  }, [tokenKey]);

  const fetchTags = useCallback(
    async (force = false) => {
      if (_tagsTokenKey !== tokenKey) {
        _tagsTokenKey = tokenKey;
        _tagsSnapshot = { tags: [], loading: true };
        _tagsLastFetch = 0;
        notifyTags();
      }
      if (_tagsSnapshot.tags.length === 0) {
        try {
          const raw = await AsyncStorage.getItem(`${STORAGE_TAGS_PREFIX}${getTokenBucket(tokenKey)}`);
          if (raw) {
            _tagsSnapshot = { tags: JSON.parse(raw), loading: false };
            notifyTags();
          }
        } catch {}
      }

      if (!force && _tagsLastFetch > 0 && Date.now() - _tagsLastFetch < SILENT_REFETCH_THROTTLE_MS) {
        return;
      }

      try {
        const res = await thoughtsService.getTags(token);
        if (res.success && res.data?.tags) {
          _tagsSnapshot = { tags: res.data.tags, loading: false };
          _tagsLastFetch = Date.now();
          notifyTags();
          AsyncStorage.setItem(
            `${STORAGE_TAGS_PREFIX}${getTokenBucket(tokenKey)}`,
            JSON.stringify(res.data.tags)
          ).catch(() => {});
        }
      } catch {
        _tagsSnapshot = { ..._tagsSnapshot, loading: false };
        notifyTags();
      }
    },
    [token, tokenKey]
  );

  useEffect(() => {
    fetchTags(false);
  }, [fetchTags]);

  return {
    tags: snapshot.tags,
    loading: snapshot.loading,
    fetchTags,
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
        await flushOfflineQueue(token);
        const res = await thoughtsService.getDayThoughts(date, token);
        const cur = getOrCreateStreamState(date, tokenKey);
        if (cur.mutationVersion !== startVersion || cur.pendingMutations > 0) {
          return;
        }

        if (res.success && res.data?.thoughts) {
          cur.thoughts = res.data.thoughts;
          cur.lastFetchAt = Date.now();
          persistStreamCache(tokenKey, date, res.data.thoughts);
          if (res.data.mentionedPeople && res.data.mentionedPeople.length > 0) {
            upsertKnownPeopleInStore(res.data.mentionedPeople, tokenKey);
          }
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

  const addThought = useCallback(
    async (
      content: string,
      category: ThoughtCategory = 'thinking',
      mentionedPersonIds?: string[],
      clientKeyOverride?: string,
      options?: {
        mood?: ThoughtMood | null;
        replyTo?: Thought | null;
      }
    ) => {
      const trimmed = content.trim();
      if (!trimmed) return null;

      const state = getOrCreateStreamState(date, tokenKey);
      const tempId =
        clientKeyOverride || `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const nowIso = new Date().toISOString();
      const extractedTags = extractHashtagsFromText(trimmed);

      const optimisticThought: StreamThought = {
        id: tempId,
        clientKey: tempId,
        user_id: '',
        day_date: date,
        content: trimmed,
        category,
        mood: options?.mood ?? null,
        tags: extractedTags,
        is_starred: false,
        reply_to_id: options?.replyTo?.id ?? null,
        reply_to_preview: options?.replyTo?.content ?? null,
        reply_to_category: options?.replyTo?.category ?? null,
        created_at: nowIso,
      };

      state.mutationVersion += 1;
      state.pendingMutations += 1;
      _daysState.pendingMutations += 1;
      state.thoughts = [...state.thoughts, optimisticThought];
      state.loading = false;
      notifyStream(date);

      syncDaySummaryFromStream(date, state.thoughts);
      bumpAnalyticsInvalidation();
      if (options?.mood) {
        setLatestMoodInStore(options.mood, tokenKey);
      }
      if (trimmed.includes('@')) {
        applyOptimisticMentionInStore(optimisticThought, mentionedPersonIds);
      }

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
              mood: options?.mood ?? null,
              replyToId:
                options?.replyTo?.id && !options.replyTo.id.startsWith('temp_')
                  ? options.replyTo.id
                  : null,
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
            clientKey: tempId,
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
        } catch {
          // Queue offline so user never loses thoughts when offline!
          const cur = getOrCreateStreamState(date, tokenKey);
          cur.thoughts = cur.thoughts.map((t) =>
            t.id === tempId ? { ...t, pendingOffline: true } : t
          );
          notifyStream(date);
          enqueueOfflineThought(tokenKey, {
            tempId,
            dayDate: date,
            content: trimmed,
            category,
            mood: options?.mood ?? null,
            replyToId:
              options?.replyTo?.id && !options.replyTo.id.startsWith('temp_')
                ? options.replyTo.id
                : null,
            mentionedPersonIds,
            createdAt: nowIso,
          });
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

  const editThought = useCallback(
    async (
      id: string,
      updates: {
        content?: string;
        mood?: ThoughtMood | null;
        isStarred?: boolean;
        mentionedPersonIds?: string[];
      }
    ) => {
      const state = getOrCreateStreamState(date, tokenKey);
      const target = state.thoughts.find((t) => t.id === id);
      if (!target) return;

      const nextContent =
        typeof updates.content === 'string' ? updates.content.trim() : target.content;
      const optimistic: StreamThought = {
        ...target,
        content: nextContent,
        tags: extractHashtagsFromText(nextContent),
        ...(updates.mood !== undefined ? { mood: updates.mood } : {}),
        ...(typeof updates.isStarred === 'boolean' ? { is_starred: updates.isStarred } : {}),
        updated_at: new Date().toISOString(),
      };

      state.mutationVersion += 1;
      state.pendingMutations += 1;
      state.thoughts = state.thoughts.map((t) => (t.id === id ? optimistic : t));
      notifyStream(date);
      syncDaySummaryFromStream(date, state.thoughts);
      bumpAnalyticsInvalidation();
      persistStreamCache(tokenKey, date, state.thoughts);
      if (updates.mood) {
        setLatestMoodInStore(updates.mood, tokenKey);
      }

      if (!id.startsWith('temp_')) {
        try {
          const res = await thoughtsService.updateThought(id, updates, token);
          if (res.success && res.data?.thought) {
            const cur = getOrCreateStreamState(date, tokenKey);
            cur.thoughts = cur.thoughts.map((t) =>
              t.id === id ? { ...res.data!.thought, clientKey: t.clientKey || id } : t
            );
            notifyStream(date);
            persistStreamCache(tokenKey, date, cur.thoughts);
            if (updates.mood === null) {
              refreshStatsMoodFromServer(token, tokenKey);
            }
          }
        } catch {
          // keep optimistic update
        } finally {
          state.pendingMutations = Math.max(0, state.pendingMutations - 1);
        }
      } else {
        state.pendingMutations = Math.max(0, state.pendingMutations - 1);
      }
    },
    [date, token, tokenKey]
  );

  const toggleStarThought = useCallback(
    async (id: string) => {
      const state = getOrCreateStreamState(date, tokenKey);
      const target = state.thoughts.find((t) => t.id === id);
      if (!target) return;
      await editThought(id, { isStarred: !target.is_starred });
    },
    [date, tokenKey, editThought]
  );

  const removeThought = useCallback(
    async (id: string) => {
      const state = getOrCreateStreamState(date, tokenKey);
      state.mutationVersion += 1;
      state.pendingMutations += 1;
      _daysState.pendingMutations += 1;

      state.thoughts = state.thoughts.filter((t) => t.id !== id);
      notifyStream(date);
      syncDaySummaryFromStream(date, state.thoughts);
      bumpAnalyticsInvalidation();
      removeOptimisticMentionThoughtsInStore([id]);
      persistStreamCache(tokenKey, date, state.thoughts);

      if (!id.startsWith('temp_')) {
        thoughtsService
          .deleteThought(id, token)
          .then(() => {
            refreshStatsMoodFromServer(token, tokenKey);
          })
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
      bumpAnalyticsInvalidation();
      removeOptimisticMentionThoughtsInStore(ids);
      persistStreamCache(tokenKey, date, state.thoughts);

      const serverIds = ids.filter((id) => !id.startsWith('temp_'));
      if (serverIds.length > 0) {
        thoughtsService
          .bulkDeleteThoughts(serverIds, token)
          .then(() => {
            refreshStatsMoodFromServer(token, tokenKey);
          })
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
    editThought,
    toggleStarThought,
    removeThought,
    removeThoughts,
  };
}
