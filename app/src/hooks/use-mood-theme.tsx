import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildColorsForMood, type ThemeColors } from '@/theme';
import type { ThoughtMood } from '@/services/thoughts.service';
import { useAuth } from './use-auth';

const STORAGE_MOOD_PREFIX = '@hunch_latest_mood_v1_';
const getBucket = (tokenKey: string | null) => tokenKey || 'guest';

let _latestMood: ThoughtMood | null = null;
let _moodTokenKey: string | null = '__uninitialized__';
let _moodHydrated = false;
let _moodColors: ThemeColors = buildColorsForMood(null);
const _listeners = new Set<() => void>();

function notifyTheme() {
  _moodColors = buildColorsForMood(_latestMood);
  _listeners.forEach((fn) => fn());
}

export function resetMoodThemeForToken(tokenKey: string | null) {
  if (_moodTokenKey === tokenKey) return;
  _moodTokenKey = tokenKey;
  _latestMood = null;
  _moodHydrated = false;
  notifyTheme();
}

export function setLatestMoodInStore(
  mood: ThoughtMood | null,
  explicitTokenKey?: string | null
) {
  const targetToken =
    explicitTokenKey !== undefined ? explicitTokenKey : _moodTokenKey;
  if (targetToken === '__uninitialized__') return;
  if (_moodTokenKey !== targetToken) {
    _moodTokenKey = targetToken;
    _moodHydrated = false;
  }

  if (_latestMood === mood && _moodHydrated) return;
  _latestMood = mood;
  _moodHydrated = true;
  notifyTheme();

  const key = `${STORAGE_MOOD_PREFIX}${getBucket(targetToken)}`;
  if (mood) {
    AsyncStorage.setItem(key, mood).catch(() => {});
  } else {
    AsyncStorage.removeItem(key).catch(() => {});
  }
}

export function applyInitialMoodStatsIfEmpty(
  mood: ThoughtMood | null,
  tokenKey: string | null
) {
  if (_moodTokenKey !== tokenKey && _moodTokenKey !== '__uninitialized__') return;
  if (_latestMood !== null) return;
  setLatestMoodInStore(mood, tokenKey);
}

async function hydrateMoodFromStorage(tokenKey: string | null) {
  if (_moodTokenKey !== tokenKey) {
    resetMoodThemeForToken(tokenKey);
  }
  if (_moodHydrated) return;
  _moodHydrated = true;
  try {
    const saved = await AsyncStorage.getItem(`${STORAGE_MOOD_PREFIX}${getBucket(tokenKey)}`);
    if (_moodTokenKey === tokenKey && saved) {
      _latestMood = saved as ThoughtMood;
      notifyTheme();
    }
  } catch {
    // ignore storage read error
  }
}

export function MoodThemeSync() {
  const { token } = useAuth();
  const tokenKey = token ?? null;

  useEffect(() => {
    hydrateMoodFromStorage(tokenKey);
  }, [tokenKey]);

  return null;
}

export function useThemeColors(): ThemeColors {
  const { token } = useAuth();
  const tokenKey = token ?? null;
  const [colors, setColors] = useState<ThemeColors>(() =>
    _moodTokenKey === tokenKey ? _moodColors : buildColorsForMood(null)
  );

  useEffect(() => {
    hydrateMoodFromStorage(tokenKey);
    setColors(_moodColors);
    const listener = () => setColors(_moodColors);
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  }, [tokenKey]);

  return colors;
}

export function useCurrentMood(): ThoughtMood | null {
  const { token } = useAuth();
  const tokenKey = token ?? null;
  const [mood, setMood] = useState<ThoughtMood | null>(() =>
    _moodTokenKey === tokenKey ? _latestMood : null
  );

  useEffect(() => {
    hydrateMoodFromStorage(tokenKey);
    setMood(_latestMood);
    const listener = () => setMood(_latestMood);
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  }, [tokenKey]);

  return mood;
}
