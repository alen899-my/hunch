import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as peopleService from '@/services/people.service';
import type { Person, PersonMentionThought } from '@/services/people.service';
import { uploadToR2 } from '@/services/upload.service';
import type { Thought } from '@/services/thoughts.service';
import {
  buildDefaultHandle,
  filterPeopleForMention,
  parseMentionSegments,
} from '@/features/people/utils/mentions';
import { useAuth } from './use-auth';

export interface LocalAvatarPayload {
  uri: string;
  mimeType: string;
}

export interface SavePersonInput {
  name: string;
  handle?: string;
  avatarUrl?: string | null;
  avatarKey?: string | null;
  relationship?: string | null;
  notes?: string | null;
  birthday?: string | null;
  localAvatar?: LocalAvatarPayload | null;
  avatarRemoved?: boolean;
}

interface PeopleStoreState {
  people: Person[];
  loading: boolean;
  error: string | null;
  tokenKey: string | null;
  hydrated: boolean;
  lastFetchAt: number;
  mutationVersion: number;
  pendingMutations: number;
}

interface PersonDetailState {
  person: Person | null;
  mentions: PersonMentionThought[];
  loading: boolean;
  error: string | null;
  tokenKey: string | null;
  lastFetchAt: number;
  mutationVersion: number;
}

export interface PeopleSnapshot {
  people: Person[];
  loading: boolean;
  error: string | null;
}

export interface PersonDetailSnapshot {
  person: Person | null;
  mentions: PersonMentionThought[];
  loading: boolean;
  error: string | null;
}

const EMPTY_PEOPLE_SNAPSHOT: PeopleSnapshot = {
  people: [],
  loading: true,
  error: null,
};

const EMPTY_DETAIL_SNAPSHOT: PersonDetailSnapshot = {
  person: null,
  mentions: [],
  loading: true,
  error: null,
};

const STORAGE_PEOPLE_PREFIX = '@hunch_people_cache_v1_';
const STORAGE_DETAIL_PREFIX = '@hunch_person_detail_v1_';
const SILENT_REFETCH_THROTTLE_MS = 4000;

const _peopleState: PeopleStoreState = {
  people: [],
  loading: true,
  error: null,
  tokenKey: '__uninitialized__',
  hydrated: false,
  lastFetchAt: 0,
  mutationVersion: 0,
  pendingMutations: 0,
};

let _peopleSnapshot: PeopleSnapshot = EMPTY_PEOPLE_SNAPSHOT;
const _detailStates = new Map<string, PersonDetailState>();
const _detailSnapshots = new Map<string, PersonDetailSnapshot>();
const _peopleListeners = new Set<() => void>();
const _detailListeners = new Map<string, Set<() => void>>();

// Maps temp_person_* IDs to in-flight creation promises and resolved server IDs
const _pendingCreates = new Map<string, Promise<Person>>();
const _resolvedTempIds = new Map<string, string>();
const _mentionSearchCache = new Map<string, Person[]>();

const getTokenBucket = (tokenKey: string | null) => tokenKey || 'guest';

function getPeopleSnapshot(tokenKey: string | null): PeopleSnapshot {
  if (_peopleState.tokenKey !== tokenKey) {
    return EMPTY_PEOPLE_SNAPSHOT;
  }
  return _peopleSnapshot;
}

function getDetailSnapshot(personId: string, tokenKey: string | null): PersonDetailSnapshot {
  if (!personId) return EMPTY_DETAIL_SNAPSHOT;
  const existing = _detailStates.get(personId);
  if (existing && existing.tokenKey === tokenKey) {
    return _detailSnapshots.get(personId) || EMPTY_DETAIL_SNAPSHOT;
  }
  const fromList = _peopleState.tokenKey === tokenKey
    ? _peopleState.people.find((p) => p.id === personId) ?? null
    : null;
  if (fromList) {
    return { person: fromList, mentions: [], loading: true, error: null };
  }
  return EMPTY_DETAIL_SNAPSHOT;
}

function notifyPeople() {
  _peopleSnapshot = {
    people: _peopleState.people,
    loading: _peopleState.loading,
    error: _peopleState.error,
  };
  _peopleListeners.forEach((fn) => fn());
}

function notifyDetail(personId: string) {
  const state = _detailStates.get(personId);
  if (state) {
    _detailSnapshots.set(personId, {
      person: state.person,
      mentions: state.mentions,
      loading: state.loading,
      error: state.error,
    });
  } else {
    _detailSnapshots.delete(personId);
  }
  _detailListeners.get(personId)?.forEach((fn) => fn());
}

function notifyAllDetails() {
  _detailListeners.forEach((listeners, personId) => {
    const state = _detailStates.get(personId);
    if (state) {
      _detailSnapshots.set(personId, {
        person: state.person,
        mentions: state.mentions,
        loading: state.loading,
        error: state.error,
      });
    } else {
      _detailSnapshots.delete(personId);
    }
    listeners.forEach((fn) => fn());
  });
}

function getOrCreateDetailState(personId: string, tokenKey: string | null): PersonDetailState {
  const existing = _detailStates.get(personId);
  if (existing && existing.tokenKey === tokenKey) {
    return existing;
  }
  const fromList = _peopleState.tokenKey === tokenKey
    ? _peopleState.people.find((p) => p.id === personId) ?? null
    : null;
  const fresh: PersonDetailState = {
    person: fromList,
    mentions: [],
    loading: !fromList,
    error: null,
    tokenKey,
    lastFetchAt: 0,
    mutationVersion: 0,
  };
  _detailStates.set(personId, fresh);
  return fresh;
}

async function persistPeopleCache(tokenKey: string | null, people: Person[]) {
  try {
    const clean = people.filter((p) => !p.id.startsWith('temp_person_'));
    await AsyncStorage.setItem(
      `${STORAGE_PEOPLE_PREFIX}${getTokenBucket(tokenKey)}`,
      JSON.stringify(clean)
    );
  } catch {
    // ignore storage quota errors
  }
}

async function persistPersonDetailCache(
  tokenKey: string | null,
  personId: string,
  person: Person | null,
  mentions: PersonMentionThought[]
) {
  if (!person || personId.startsWith('temp_person_')) return;
  try {
    await AsyncStorage.setItem(
      `${STORAGE_DETAIL_PREFIX}${getTokenBucket(tokenKey)}_${personId}`,
      JSON.stringify({ person, mentions })
    );
  } catch {
    // ignore storage errors
  }
}

function resetStoresForToken(tokenKey: string | null) {
  _peopleState.people = [];
  _peopleState.loading = true;
  _peopleState.error = null;
  _peopleState.tokenKey = tokenKey;
  _peopleState.hydrated = false;
  _peopleState.lastFetchAt = 0;
  _peopleState.mutationVersion += 1;
  _peopleState.pendingMutations = 0;
  _detailStates.clear();
  _mentionSearchCache.clear();
  notifyPeople();
  notifyAllDetails();
}

async function hydratePeopleFromStorage(tokenKey: string | null) {
  if (_peopleState.tokenKey !== tokenKey) {
    resetStoresForToken(tokenKey);
  }
  if (_peopleState.hydrated) return;
  _peopleState.hydrated = true;

  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PEOPLE_PREFIX}${getTokenBucket(tokenKey)}`);
    if (raw && _peopleState.tokenKey === tokenKey && _peopleState.people.length === 0) {
      const parsed = JSON.parse(raw) as Person[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        _peopleState.people = parsed;
        _peopleState.loading = false;
        notifyPeople();
      }
    }
  } catch {
    // ignore cache parse errors
  }
}

async function hydrateDetailFromStorage(tokenKey: string | null, personId: string) {
  const state = getOrCreateDetailState(personId, tokenKey);
  if (state.mentions.length > 0) return;
  try {
    const raw = await AsyncStorage.getItem(
      `${STORAGE_DETAIL_PREFIX}${getTokenBucket(tokenKey)}_${personId}`
    );
    if (raw) {
      const parsed = JSON.parse(raw) as { person?: Person; mentions?: PersonMentionThought[] };
      const cur = getOrCreateDetailState(personId, tokenKey);
      if (cur.mentions.length === 0 && parsed.person) {
        cur.person = parsed.person;
        cur.mentions = parsed.mentions || [];
        cur.loading = false;
        notifyDetail(personId);
      }
    }
  } catch {
    // ignore
  }
}

function extractSearchableText(content: string): string {
  const trimmed = content?.trim() || '';
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.type === 'attachment') {
        return typeof parsed.caption === 'string' ? parsed.caption : '';
      }
    } catch {
      // treat as text
    }
  }
  return content;
}

export function resolveMentionedPeopleFromContent(
  content: string,
  explicitIds: string[] = []
): Person[] {
  const searchable = extractSearchableText(content);
  if (!searchable || !searchable.includes('@') || _peopleState.people.length === 0) {
    return [];
  }

  const byId = new Map(_peopleState.people.map((p) => [p.id, p]));
  const matched = new Map<string, Person>();

  for (const rawId of explicitIds) {
    const resolvedId = _resolvedTempIds.get(rawId) || rawId;
    const p = byId.get(resolvedId) || byId.get(rawId);
    if (p) {
      const lower = searchable.toLowerCase();
      if (
        lower.includes(`@${p.name.toLowerCase()}`) ||
        lower.includes(`@${p.handle.toLowerCase()}`)
      ) {
        matched.set(p.id, p);
      }
    }
  }

  const segments = parseMentionSegments(searchable, _peopleState.people);
  for (const seg of segments) {
    if (seg.person) {
      matched.set(seg.person.id, seg.person);
    }
  }

  return [...matched.values()];
}

export function applyOptimisticMentionInStore(
  thought: Thought,
  explicitIds: string[] = []
) {
  const mentionedPeople = resolveMentionedPeopleFromContent(thought.content, explicitIds);
  if (mentionedPeople.length === 0) return;

  const mentionedIdSet = new Set(mentionedPeople.map((p) => p.id));
  _peopleState.mutationVersion += 1;
  _peopleState.people = _peopleState.people.map((p) => {
    if (!mentionedIdSet.has(p.id)) return p;
    return {
      ...p,
      mention_count: (p.mention_count || 0) + 1,
      last_mentioned_at: thought.created_at,
    };
  });
  notifyPeople();
  persistPeopleCache(_peopleState.tokenKey, _peopleState.people);

  for (const person of mentionedPeople) {
    const detail = _detailStates.get(person.id);
    if (detail && detail.tokenKey === _peopleState.tokenKey) {
      detail.mutationVersion += 1;
      const alreadyExists = detail.mentions.some((m) => m.id === thought.id);
      if (!alreadyExists) {
        detail.mentions = [{ ...thought, mentioned_at: thought.created_at }, ...detail.mentions];
      }
      if (detail.person) {
        detail.person = {
          ...detail.person,
          mention_count: (detail.person.mention_count || 0) + 1,
          last_mentioned_at: thought.created_at,
        };
      }
      notifyDetail(person.id);
      persistPersonDetailCache(_peopleState.tokenKey, person.id, detail.person, detail.mentions);
    }
  }
}

export function replaceOptimisticMentionThoughtInStore(tempId: string, savedThought: Thought) {
  _detailStates.forEach((detail, personId) => {
    const idx = detail.mentions.findIndex((m) => m.id === tempId);
    if (idx !== -1) {
      const next = [...detail.mentions];
      next[idx] = { ...savedThought, mentioned_at: savedThought.created_at };
      detail.mentions = next;
      notifyDetail(personId);
      persistPersonDetailCache(_peopleState.tokenKey, personId, detail.person, detail.mentions);
    }
  });
}

export function removeOptimisticMentionThoughtsInStore(thoughtIds: string[]) {
  if (!thoughtIds.length) return;
  const idSet = new Set(thoughtIds);
  const removedCountsByPerson = new Map<string, number>();

  _detailStates.forEach((detail, personId) => {
    const beforeCount = detail.mentions.length;
    const filtered = detail.mentions.filter((m) => !idSet.has(m.id));
    const removed = beforeCount - filtered.length;
    if (removed > 0) {
      detail.mutationVersion += 1;
      detail.mentions = filtered;
      removedCountsByPerson.set(personId, removed);
      if (detail.person) {
        detail.person = {
          ...detail.person,
          mention_count: Math.max(0, (detail.person.mention_count || 0) - removed),
          last_mentioned_at: filtered[0]?.created_at ?? null,
        };
      }
      notifyDetail(personId);
      persistPersonDetailCache(_peopleState.tokenKey, personId, detail.person, detail.mentions);
    }
  });

  if (removedCountsByPerson.size > 0) {
    _peopleState.mutationVersion += 1;
    _peopleState.people = _peopleState.people.map((p) => {
      const dec = removedCountsByPerson.get(p.id);
      if (!dec) return p;
      return {
        ...p,
        mention_count: Math.max(0, (p.mention_count || 0) - dec),
      };
    });
    notifyPeople();
    persistPeopleCache(_peopleState.tokenKey, _peopleState.people);
  } else {
    // Force background sync next focus for any uncached person details
    _peopleState.lastFetchAt = 0;
  }
}

export async function waitForPendingPeopleCreations(ids: string[] = []): Promise<string[]> {
  if (_pendingCreates.size > 0) {
    await Promise.allSettled([..._pendingCreates.values()]);
  }
  return ids
    .map((id) => _resolvedTempIds.get(id) || id)
    .filter((id) => !id.startsWith('temp_person_'));
}

export function invalidatePeopleCache() {
  _peopleState.lastFetchAt = 0;
  _mentionSearchCache.clear();
  _detailStates.forEach((d) => {
    d.lastFetchAt = 0;
  });
}

export function upsertKnownPeopleInStore(
  incoming: Person[],
  explicitTokenKey?: string | null
) {
  if (!Array.isArray(incoming) || incoming.length === 0) return;
  const targetToken =
    explicitTokenKey !== undefined ? explicitTokenKey : _peopleState.tokenKey;
  if (targetToken === '__uninitialized__') return;
  if (_peopleState.tokenKey !== targetToken) {
    resetStoresForToken(targetToken);
  }

  const map = new Map(_peopleState.people.map((p) => [p.id, p]));
  let changed = false;

  for (const item of incoming) {
    if (!item?.id) continue;
    const resolvedId = _resolvedTempIds.get(item.id) || item.id;
    const existing = map.get(resolvedId) || map.get(item.id);
    if (existing) {
      const merged: Person = {
        ...existing,
        ...item,
        id: existing.id,
        mention_count: Math.max(existing.mention_count || 0, item.mention_count || 0),
        last_mentioned_at: item.last_mentioned_at || existing.last_mentioned_at || null,
      };
      if (
        merged.name !== existing.name ||
        merged.handle !== existing.handle ||
        merged.avatar_url !== existing.avatar_url ||
        merged.mention_count !== existing.mention_count
      ) {
        map.set(existing.id, merged);
        changed = true;
      }
    } else {
      map.set(item.id, item);
      changed = true;
    }
  }

  if (changed) {
    _peopleState.people = [...map.values()];
    _peopleState.loading = false;
    notifyPeople();
  }
}

async function fetchPeopleInternal(token: string | null, isSilent = false) {
  const tokenKey = token ?? null;
  if (_peopleState.tokenKey !== tokenKey) {
    resetStoresForToken(tokenKey);
  }
  await hydratePeopleFromStorage(tokenKey);

  const now = Date.now();
  if (
    isSilent &&
    _peopleState.lastFetchAt > 0 &&
    now - _peopleState.lastFetchAt < SILENT_REFETCH_THROTTLE_MS &&
    _peopleState.pendingMutations === 0
  ) {
    return;
  }

  if (!isSilent && _peopleState.people.length === 0) {
    _peopleState.loading = true;
    notifyPeople();
  }

  const startVersion = _peopleState.mutationVersion;
  try {
    const res = await peopleService.getPeople(token);
    if (_peopleState.tokenKey !== tokenKey) return;
    if (_peopleState.mutationVersion !== startVersion || _peopleState.pendingMutations > 0) {
      return;
    }

    if (res.success && res.data?.people) {
      _peopleState.people = res.data.people;
      _peopleState.lastFetchAt = Date.now();
      _peopleState.error = null;
      notifyPeople();
      persistPeopleCache(tokenKey, res.data.people);
    }
  } catch (err: any) {
    if (_peopleState.people.length === 0) {
      _peopleState.error = err?.message || 'Could not load people';
    }
  } finally {
    _peopleState.loading = false;
    notifyPeople();
  }
}

export function usePeople(options?: { autoFetch?: boolean }) {
  const autoFetch = options?.autoFetch ?? true;
  const { token } = useAuth();
  const tokenKey = token ?? null;
  const [snapshot, setSnapshot] = useState<PeopleSnapshot>(() => getPeopleSnapshot(tokenKey));

  useEffect(() => {
    setSnapshot(getPeopleSnapshot(tokenKey));
    const listener = () => setSnapshot(getPeopleSnapshot(tokenKey));
    _peopleListeners.add(listener);
    return () => {
      _peopleListeners.delete(listener);
    };
  }, [tokenKey]);

  useEffect(() => {
    if (autoFetch) {
      fetchPeopleInternal(
        token ?? null,
        _peopleState.people.length > 0 && _peopleState.tokenKey === tokenKey
      );
    } else {
      hydratePeopleFromStorage(tokenKey);
    }
  }, [autoFetch, token, tokenKey]);

  const fetchPeople = useCallback(
    async (isSilent = false) => {
      await fetchPeopleInternal(token ?? null, isSilent);
    },
    [token]
  );

  const addPerson = useCallback(
    async (input: SavePersonInput): Promise<Person> => {
      const cleanName = input.name.trim();
      const baseHandle = buildDefaultHandle(input.handle || cleanName) || 'person';

      // Instant local uniqueness check when handle is explicitly provided
      if (input.handle) {
        const requested = buildDefaultHandle(input.handle);
        const duplicate = _peopleState.people.find(
          (p) => p.handle.toLowerCase() === requested.toLowerCase()
        );
        if (duplicate) {
          throw new Error(`Handle @${requested} is already taken`);
        }
      }

      // Generate unique optimistic handle if auto-generated
      let optimisticHandle = baseHandle;
      let suffix = 2;
      while (_peopleState.people.some((p) => p.handle.toLowerCase() === optimisticHandle)) {
        optimisticHandle = `${baseHandle}_${suffix}`;
        suffix += 1;
      }

      const tempId = `temp_person_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const nowIso = new Date().toISOString();
      const optimisticPerson: Person = {
        id: tempId,
        name: cleanName,
        handle: optimisticHandle,
        avatar_url: input.localAvatar?.uri || input.avatarUrl || null,
        avatar_key: input.avatarKey || null,
        relationship: input.relationship?.trim() || null,
        notes: input.notes?.trim() || null,
        birthday: input.birthday?.trim() || null,
        mention_count: 0,
        last_mentioned_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      // Instant 0ms update to global reactive store
      _mentionSearchCache.clear();
      _peopleState.mutationVersion += 1;
      _peopleState.pendingMutations += 1;
      _peopleState.people = [optimisticPerson, ..._peopleState.people];
      _peopleState.loading = false;
      notifyPeople();

      // Background upload + API creation
      const createPromise = (async () => {
        try {
          let avatarUrl = input.avatarUrl;
          let avatarKey = input.avatarKey;

          if (input.localAvatar) {
            const uploaded = await uploadToR2(input.localAvatar.uri, input.localAvatar.mimeType);
            avatarUrl = uploaded.publicUrl;
            avatarKey = uploaded.key;
          }

          const res = await peopleService.createPerson(
            {
              name: cleanName,
              handle: input.handle ? optimisticHandle : undefined,
              ...(avatarUrl !== undefined ? { avatarUrl } : {}),
              ...(avatarKey !== undefined ? { avatarKey } : {}),
              ...(input.relationship !== undefined ? { relationship: input.relationship } : {}),
              ...(input.notes !== undefined ? { notes: input.notes } : {}),
              ...(input.birthday !== undefined ? { birthday: input.birthday } : {}),
            },
            token
          );

          if (!res.success || !res.data?.person) {
            throw new Error(res.message || 'Could not add person');
          }

          const confirmed = res.data.person;
          _resolvedTempIds.set(tempId, confirmed.id);

          // Preserve any optimistic mentions that happened while creating
          const currentOptimistic = _peopleState.people.find((p) => p.id === tempId);
          const mergedPerson: Person = {
            ...confirmed,
            mention_count: Math.max(confirmed.mention_count || 0, currentOptimistic?.mention_count || 0),
            last_mentioned_at: currentOptimistic?.last_mentioned_at ?? confirmed.last_mentioned_at,
          };

          _peopleState.people = _peopleState.people.map((p) =>
            p.id === tempId ? mergedPerson : p
          );
          _peopleState.lastFetchAt = Date.now();
          notifyPeople();
          persistPeopleCache(_peopleState.tokenKey, _peopleState.people);
          return mergedPerson;
        } catch (err: any) {
          // Roll back optimistic person
          _peopleState.people = _peopleState.people.filter((p) => p.id !== tempId);
          notifyPeople();
          Alert.alert('Could not save person', err?.message || 'Please check your connection.');
          throw err;
        } finally {
          _pendingCreates.delete(tempId);
          _peopleState.pendingMutations = Math.max(0, _peopleState.pendingMutations - 1);
        }
      })();

      _pendingCreates.set(tempId, createPromise);
      return optimisticPerson;
    },
    [token]
  );

  const editPerson = useCallback(
    async (id: string, input: SavePersonInput): Promise<Person> => {
      const existing = _peopleState.people.find((p) => p.id === id);
      const cleanName = input.name.trim();
      const nextHandle = input.handle ? buildDefaultHandle(input.handle) : existing?.handle || 'person';

      if (input.handle) {
        const duplicate = _peopleState.people.find(
          (p) => p.id !== id && p.handle.toLowerCase() === nextHandle.toLowerCase()
        );
        if (duplicate) {
          throw new Error(`Handle @${nextHandle} is already taken`);
        }
      }

      const nextAvatarUrl = input.avatarRemoved
        ? null
        : input.localAvatar?.uri || (input.avatarUrl !== undefined ? input.avatarUrl : existing?.avatar_url ?? null);

      const optimisticUpdated: Person = {
        ...(existing || {
          id,
          name: cleanName,
          handle: nextHandle,
          mention_count: 0,
          created_at: new Date().toISOString(),
        }),
        name: cleanName,
        handle: nextHandle,
        avatar_url: nextAvatarUrl,
        ...(input.relationship !== undefined
          ? { relationship: input.relationship?.trim() || null }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        ...(input.birthday !== undefined ? { birthday: input.birthday?.trim() || null } : {}),
        updated_at: new Date().toISOString(),
      };

      // Instant 0ms update across list and detail stores
      _mentionSearchCache.clear();
      _peopleState.mutationVersion += 1;
      _peopleState.pendingMutations += 1;
      _peopleState.people = _peopleState.people.map((p) =>
        p.id === id ? optimisticUpdated : p
      );
      notifyPeople();

      const detail = _detailStates.get(id);
      if (detail) {
        detail.mutationVersion += 1;
        detail.person = optimisticUpdated;
        notifyDetail(id);
      }

      // Sync upload + PATCH in background
      (async () => {
        try {
          const resolvedId = (await waitForPendingPeopleCreations([id]))[0] || id;
          let avatarUrl = input.avatarRemoved ? null : input.avatarUrl;
          let avatarKey = input.avatarRemoved ? null : input.avatarKey;

          if (input.localAvatar) {
            const uploaded = await uploadToR2(input.localAvatar.uri, input.localAvatar.mimeType);
            avatarUrl = uploaded.publicUrl;
            avatarKey = uploaded.key;
          }

          const res = await peopleService.updatePerson(
            resolvedId,
            {
              name: cleanName,
              handle: nextHandle,
              ...(avatarUrl !== undefined ? { avatarUrl } : {}),
              ...(avatarKey !== undefined ? { avatarKey } : {}),
              ...(input.relationship !== undefined ? { relationship: input.relationship } : {}),
              ...(input.notes !== undefined ? { notes: input.notes } : {}),
              ...(input.birthday !== undefined ? { birthday: input.birthday } : {}),
            },
            token
          );

          if (res.success && res.data?.person) {
            const confirmed = res.data.person;
            _peopleState.people = _peopleState.people.map((p) =>
              p.id === id || p.id === resolvedId ? confirmed : p
            );
            _peopleState.lastFetchAt = Date.now();
            notifyPeople();
            persistPeopleCache(_peopleState.tokenKey, _peopleState.people);

            const curDetail = _detailStates.get(id);
            if (curDetail) {
              curDetail.person = confirmed;
              notifyDetail(id);
              persistPersonDetailCache(_peopleState.tokenKey, id, confirmed, curDetail.mentions);
            }
          }
        } catch (err: any) {
          if (existing) {
            _peopleState.people = _peopleState.people.map((p) => (p.id === id ? existing : p));
            notifyPeople();
            const curDetail = _detailStates.get(id);
            if (curDetail) {
              curDetail.person = existing;
              notifyDetail(id);
            }
          }
          Alert.alert('Could not update person', err?.message || 'Please check your connection.');
        } finally {
          _peopleState.pendingMutations = Math.max(0, _peopleState.pendingMutations - 1);
        }
      })();

      return optimisticUpdated;
    },
    [token]
  );

  const removePerson = useCallback(
    async (id: string) => {
      const backupList = _peopleState.people;
      const backupDetail = _detailStates.get(id);

      // Instant 0ms removal
      _mentionSearchCache.clear();
      _peopleState.mutationVersion += 1;
      _peopleState.pendingMutations += 1;
      _peopleState.people = _peopleState.people.filter((p) => p.id !== id);
      _detailStates.delete(id);
      notifyPeople();
      notifyDetail(id);
      persistPeopleCache(_peopleState.tokenKey, _peopleState.people);

      (async () => {
        try {
          const resolvedId = (await waitForPendingPeopleCreations([id]))[0] || id;
          await peopleService.deletePerson(resolvedId, token);
          AsyncStorage.removeItem(
            `${STORAGE_DETAIL_PREFIX}${getTokenBucket(_peopleState.tokenKey)}_${resolvedId}`
          ).catch(() => {});
        } catch (err: any) {
          _peopleState.people = backupList;
          if (backupDetail) _detailStates.set(id, backupDetail);
          notifyPeople();
          notifyDetail(id);
          Alert.alert('Could not delete person', err?.message || 'Please try again.');
        } finally {
          _peopleState.pendingMutations = Math.max(0, _peopleState.pendingMutations - 1);
        }
      })();

      return true;
    },
    [token]
  );

  return {
    people: snapshot.people,
    loading: snapshot.loading,
    error: snapshot.error,
    fetchPeople,
    addPerson,
    editPerson,
    removePerson,
  };
}

export function usePersonDetails(personId: string) {
  const { token } = useAuth();
  const tokenKey = token ?? null;
  const [snapshot, setSnapshot] = useState<PersonDetailSnapshot>(() =>
    getDetailSnapshot(personId, tokenKey)
  );

  useEffect(() => {
    if (!personId) return;
    setSnapshot(getDetailSnapshot(personId, tokenKey));
    const listener = () => setSnapshot(getDetailSnapshot(personId, tokenKey));
    let set = _detailListeners.get(personId);
    if (!set) {
      set = new Set();
      _detailListeners.set(personId, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }, [personId, tokenKey]);

  const fetchDetails = useCallback(
    async (isSilent = false) => {
      if (!personId) return;
      const resolvedId = _resolvedTempIds.get(personId) || personId;
      const state = getOrCreateDetailState(personId, tokenKey);
      await hydrateDetailFromStorage(tokenKey, personId);

      const now = Date.now();
      if (
        isSilent &&
        state.lastFetchAt > 0 &&
        now - state.lastFetchAt < SILENT_REFETCH_THROTTLE_MS &&
        _peopleState.pendingMutations === 0
      ) {
        return;
      }

      if (!isSilent && !state.person) {
        state.loading = true;
        notifyDetail(personId);
      }
      state.error = null;

      const startVersion = state.mutationVersion;
      const startPeopleVersion = _peopleState.mutationVersion;

      try {
        if (resolvedId.startsWith('temp_person_')) {
          await waitForPendingPeopleCreations([resolvedId]);
        }
        const finalId = _resolvedTempIds.get(personId) || personId;
        if (finalId.startsWith('temp_person_')) {
          state.loading = false;
          notifyDetail(personId);
          return;
        }

        const res = await peopleService.getPersonDetails(finalId, token);
        const curState = getOrCreateDetailState(personId, tokenKey);
        if (
          curState.mutationVersion !== startVersion ||
          _peopleState.mutationVersion !== startPeopleVersion ||
          _peopleState.pendingMutations > 0
        ) {
          return;
        }

        if (res.success && res.data?.person) {
          curState.person = res.data.person;
          curState.mentions = res.data.mentions || [];
          curState.lastFetchAt = Date.now();
          curState.error = null;
          persistPersonDetailCache(tokenKey, finalId, curState.person, curState.mentions);
        } else if (!curState.person) {
          curState.error = res.message || 'Person not found';
        }
      } catch (err: any) {
        const curState = getOrCreateDetailState(personId, tokenKey);
        if (!curState.person) {
          curState.error = err?.message || 'Could not load person details';
        }
      } finally {
        const curState = getOrCreateDetailState(personId, tokenKey);
        curState.loading = false;
        notifyDetail(personId);
      }
    },
    [personId, token, tokenKey]
  );

  useEffect(() => {
    if (!personId) return;
    const state = getOrCreateDetailState(personId, tokenKey);
    fetchDetails(Boolean(state.person && state.lastFetchAt > 0));
  }, [personId, tokenKey, fetchDetails]);

  const setPerson = useCallback(
    (updated: Person) => {
      if (!personId) return;
      const state = getOrCreateDetailState(personId, tokenKey);
      state.person = updated;
      notifyDetail(personId);
    },
    [personId, tokenKey]
  );

  return {
    person: snapshot.person,
    mentions: snapshot.mentions,
    loading: snapshot.loading,
    error: snapshot.error,
    setPerson,
    fetchDetails,
  };
}

/**
 * Queries matching people from `/api/people?q=...` ONLY after the user enters
 * at least one letter/character after `@`, rather than fetching everyone up front.
 */
export function useMentionPeopleSearch(
  query: string,
  enabled = true,
  extraFallbackPeople: Person[] = []
) {
  const { token } = useAuth();
  const tokenKey = token ?? null;
  const trimmed = query.trim();
  const [remoteState, setRemoteState] = useState<{
    queryKey: string;
    results: Person[];
    searching: boolean;
  }>({
    queryKey: '',
    results: [],
    searching: false,
  });
  const reqSeqRef = useRef(0);

  const normalizedKey = enabled && trimmed.length > 0
    ? `${getTokenBucket(tokenKey)}::${trimmed.toLowerCase()}`
    : '';

  useEffect(() => {
    if (!enabled || !trimmed) {
      reqSeqRef.current += 1;
      setRemoteState({ queryKey: '', results: [], searching: false });
      return;
    }

    const cacheKey = `${getTokenBucket(tokenKey)}::${trimmed.toLowerCase()}`;
    const cached = _mentionSearchCache.get(cacheKey);
    if (cached) {
      setRemoteState({ queryKey: cacheKey, results: cached, searching: false });
      return;
    }

    const reqId = ++reqSeqRef.current;
    setRemoteState((prev) => ({
      queryKey: cacheKey,
      results: prev.queryKey === cacheKey ? prev.results : [],
      searching: true,
    }));

    const timer = setTimeout(async () => {
      try {
        const res = await peopleService.searchPeople(trimmed, 15, token);
        if (reqSeqRef.current !== reqId) return;
        const rows = res.success && Array.isArray(res.data?.people) ? res.data.people : [];
        _mentionSearchCache.set(cacheKey, rows);
        setRemoteState({ queryKey: cacheKey, results: rows, searching: false });
      } catch {
        if (reqSeqRef.current !== reqId) return;
        setRemoteState((prev) => ({
          queryKey: cacheKey,
          results: prev.queryKey === cacheKey ? prev.results : [],
          searching: false,
        }));
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [enabled, trimmed, token, tokenKey]);

  if (!enabled || !trimmed) {
    return { results: [] as Person[], searching: false };
  }

  // Merge remote search hits with any optimistic temp people or passed fallback matches
  const localPool =
    extraFallbackPeople.length > 0
      ? [..._peopleState.people, ...extraFallbackPeople]
      : _peopleState.people;
  const localMatches = filterPeopleForMention(localPool, trimmed);
  const remoteMatches =
    remoteState.queryKey === normalizedKey
      ? remoteState.results
      : _mentionSearchCache.get(normalizedKey) || [];

  const mergedMap = new Map<string, Person>();
  for (const p of remoteMatches) mergedMap.set(p.id, p);
  for (const p of localMatches) {
    if (!mergedMap.has(p.id)) mergedMap.set(p.id, p);
  }

  return {
    results: filterPeopleForMention([...mergedMap.values()], trimmed),
    searching: remoteState.searching,
  };
}
