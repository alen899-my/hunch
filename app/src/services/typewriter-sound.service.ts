import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform, Vibration } from 'react-native';

const SOUND_KEY = require('../../assets/sounds/typewriter-key.wav');
const SOUND_SPACE = require('../../assets/sounds/typewriter-space.wav');
const SOUND_BACKSPACE = require('../../assets/sounds/typewriter-backspace.wav');
const SOUND_BELL = require('../../assets/sounds/typewriter-bell.wav');

let isMuted = false;
let isAudioModeConfigured = false;

// Audio player instances
let keyPlayers: AudioPlayer[] = [];
let keyIndex = 0;
const KEY_POOL_SIZE = 3;

let spacePlayer: AudioPlayer | null = null;
let backspacePlayer: AudioPlayer | null = null;
let bellPlayer: AudioPlayer | null = null;

// Initialize players
function initSoundPool() {
  if (keyPlayers.length > 0) return;
  try {
    for (let i = 0; i < KEY_POOL_SIZE; i++) {
      keyPlayers.push(createAudioPlayer(SOUND_KEY));
    }
    spacePlayer = createAudioPlayer(SOUND_SPACE);
    backspacePlayer = createAudioPlayer(SOUND_BACKSPACE);
    bellPlayer = createAudioPlayer(SOUND_BELL);
  } catch (err) {
    console.warn('Typewriter sound init error:', err);
  }
}

// Ensure audio mode permits simultaneous playback
async function ensureAudioMode() {
  if (isAudioModeConfigured) return;
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    });
    isAudioModeConfigured = true;
  } catch {}
}

export type TypewriterSoundType = 'key' | 'space' | 'backspace' | 'bell';

export function playTypewriterSound(type: TypewriterSoundType = 'key') {
  if (isMuted) return;

  // 1. Tactile mechanical haptic kick via built-in React Native Vibration
  try {
    if (Platform.OS !== 'web') {
      if (type === 'bell') {
        Vibration.vibrate([0, 40, 50, 40]);
      } else if (type === 'space') {
        Vibration.vibrate(18);
      } else if (type === 'backspace') {
        Vibration.vibrate(14);
      } else {
        Vibration.vibrate(8);
      }
    }
  } catch {}

  // 2. Play mechanical audio click
  try {
    ensureAudioMode();
    initSoundPool();

    if (type === 'key') {
      if (keyPlayers.length > 0) {
        const player = keyPlayers[keyIndex];
        keyIndex = (keyIndex + 1) % keyPlayers.length;
        try {
          player.seekTo(0);
        } catch {}
        player.play();
      }
    } else if (type === 'space') {
      if (spacePlayer) {
        try {
          spacePlayer.seekTo(0);
        } catch {}
        spacePlayer.play();
      }
    } else if (type === 'backspace') {
      if (backspacePlayer) {
        try {
          backspacePlayer.seekTo(0);
        } catch {}
        backspacePlayer.play();
      }
    } else if (type === 'bell') {
      if (bellPlayer) {
        try {
          bellPlayer.seekTo(0);
        } catch {}
        bellPlayer.play();
      }
    }
  } catch (err) {
    // Graceful fallback if native audio is busy
  }
}

export function toggleTypewriterMute(): boolean {
  isMuted = !isMuted;
  return isMuted;
}

export function isTypewriterMuted(): boolean {
  return isMuted;
}
