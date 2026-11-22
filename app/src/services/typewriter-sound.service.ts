import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform, Vibration } from 'react-native';

const SOUND_KEY = require('../../assets/sounds/typewriter-key.wav');
const SOUND_SPACE = require('../../assets/sounds/typewriter-space.wav');
const SOUND_BACKSPACE = require('../../assets/sounds/typewriter-backspace.wav');
const SOUND_BELL = require('../../assets/sounds/typewriter-bell.wav');

let isMuted = false;
let isConfigured = false;

// Audio player instances pool for zero-latency concurrent playback
let keyPlayers: AudioPlayer[] = [];
let keyIndex = 0;
const KEY_POOL_SIZE = 4;

let spacePlayer: AudioPlayer | null = null;
let backspacePlayer: AudioPlayer | null = null;
let bellPlayer: AudioPlayer | null = null;

function initPool() {
  if (keyPlayers.length > 0) return;
  try {
    for (let i = 0; i < KEY_POOL_SIZE; i++) {
      keyPlayers.push(createAudioPlayer(SOUND_KEY));
    }
    spacePlayer = createAudioPlayer(SOUND_SPACE);
    backspacePlayer = createAudioPlayer(SOUND_BACKSPACE);
    bellPlayer = createAudioPlayer(SOUND_BELL);

    setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {});
    isConfigured = true;
  } catch (err) {
    console.warn('Typewriter sound init:', err);
  }
}

// Pre-initialize in idle time so first key tap has 0ms latency
setTimeout(initPool, 100);

export type TypewriterSoundType = 'key' | 'space' | 'backspace' | 'bell';

/**
 * Super lightweight, non-blocking sound trigger.
 * Wrapped in setTimeout(..., 0) so it never blocks the React Native UI thread or typing speed.
 * Vibration is removed from regular keystrokes to ensure 120 FPS buttery typing.
 */
export function playTypewriterSound(type: TypewriterSoundType = 'key') {
  if (isMuted) return;

  setTimeout(() => {
    try {
      if (!isConfigured) initPool();

      if (type === 'key') {
        if (keyPlayers.length > 0) {
          const player = keyPlayers[keyIndex];
          keyIndex = (keyIndex + 1) % keyPlayers.length;
          player.seekTo(0);
          player.play();
        }
      } else if (type === 'space') {
        if (spacePlayer) {
          spacePlayer.seekTo(0);
          spacePlayer.play();
        }
      } else if (type === 'backspace') {
        if (backspacePlayer) {
          backspacePlayer.seekTo(0);
          backspacePlayer.play();
        }
      } else if (type === 'bell') {
        if (Platform.OS !== 'web') {
          try {
            Vibration.vibrate(25);
          } catch {}
        }
        if (bellPlayer) {
          bellPlayer.seekTo(0);
          bellPlayer.play();
        }
      }
    } catch {
      // Graceful drop if audio bridge is busy
    }
  }, 0);
}

export function toggleTypewriterMute(): boolean {
  isMuted = !isMuted;
  return isMuted;
}

export function isTypewriterMuted(): boolean {
  return isMuted;
}
