import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import { AppText } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize, Shadow } from '@/theme';

export interface AudioUploadResult {
  localUri: string;
  duration: number;
  mimeType: string;
  publicUrl?: string;
  key?: string;
  size?: number;
}

interface AudioRecorderProps {
  visible: boolean;
  onClose: () => void;
  onUpload: (result: AudioUploadResult) => void;
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'done';

const SPIKE_BARS = [16, 26, 42, 54, 38, 22, 32, 48, 60, 44, 28, 36, 52, 40, 24, 34, 50, 36, 20];

export function AudioRecorderModal({ visible, onClose, onUpload }: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);

  // Modern Expo Audio recorder hook
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const previewPlayerRef = useRef<AudioPlayer | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animated spike lines (19 animated bars for dynamic waveform)
  const barAnims = useRef(SPIKE_BARS.map(() => new Animated.Value(0.2))).current;

  useEffect(() => {
    if (!visible) {
      cleanup();
    }
  }, [visible]);

  // Animate dancing spike bars during recording
  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];

    if (state === 'recording') {
      barAnims.forEach((anim, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.35 + Math.random() * 0.65,
              duration: 160 + (i % 5) * 40,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.15 + Math.random() * 0.35,
              duration: 160 + (i % 5) * 35,
              useNativeDriver: true,
            }),
          ])
        );
        loops.push(loop);
        loop.start();
      });
    } else {
      barAnims.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0.25,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }

    return () => loops.forEach((l) => l.stop());
  }, [state]);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    try {
      if (previewPlayerRef.current) {
        previewPlayerRef.current.pause();
        previewPlayerRef.current.remove();
        previewPlayerRef.current = null;
      }
    } catch {}
    setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    }).catch(() => {});
    setState('idle');
    setDuration(0);
    setRecordedUri(null);
    setRecordedDuration(0);
    setIsPlayingPreview(false);
    setPreviewProgress(0);
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  // ── Start actual microphone audio recording ──────────────────
  const startRecording = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone needed', 'Please allow microphone access to record voice notes.');
        return;
      }

      // Configure system audio for active recording
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

      setState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err: any) {
      Alert.alert('Recording error', err?.message || 'Could not start audio recording.');
    }
  };

  const pauseRecording = () => {
    try {
      recorder.pause();
    } catch {}
    if (timerRef.current) clearInterval(timerRef.current);
    setState('paused');
  };

  const resumeRecording = () => {
    try {
      recorder.record();
    } catch {}
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    setState('recording');
  };

  // ── Stop recording and retrieve real recorded audio URI ──────
  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const finalDuration = Math.max(duration, 1);
    setRecordedDuration(finalDuration);

    try {
      await recorder.stop();

      // Switch audio mode back to speaker output
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      const realUri = recorder.uri;
      if (realUri) {
        setRecordedUri(realUri);
        setState('done');
      } else {
        throw new Error('No recorded audio file returned');
      }
    } catch (err: any) {
      Alert.alert('Recording error', err?.message || 'Could not complete audio recording.');
      setState('idle');
    }
  };

  // ── Real audio preview playback ──────────────────────────────
  const togglePlaybackPreview = async () => {
    if (!recordedUri) return;

    if (isPlayingPreview) {
      try {
        previewPlayerRef.current?.pause();
      } catch {}
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      setIsPlayingPreview(false);
    } else {
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });

        if (!previewPlayerRef.current) {
          previewPlayerRef.current = createAudioPlayer(recordedUri);
          previewPlayerRef.current.addListener('playbackStatusUpdate', (status) => {
            if (status.currentTime !== undefined) {
              setPreviewProgress(Math.floor(status.currentTime));
            }
            if (status.playing !== undefined) {
              setIsPlayingPreview(status.playing);
            }
            if (
              status.currentTime >= (status.duration || recordedDuration || 1) &&
              !status.playing
            ) {
              setIsPlayingPreview(false);
              setPreviewProgress(0);
              try {
                previewPlayerRef.current?.seekTo(0);
              } catch {}
            }
          });
        }

        previewPlayerRef.current.play();
        setIsPlayingPreview(true);
      } catch (err: any) {
        Alert.alert('Playback error', err?.message || 'Could not play audio preview.');
      }
    }
  };

  // ── Send recorded voice note ─────────────────────────────────
  const handleSend = () => {
    if (!recordedUri) return;
    try {
      if (previewPlayerRef.current) {
        previewPlayerRef.current.pause();
        previewPlayerRef.current.remove();
        previewPlayerRef.current = null;
      }
    } catch {}

    onUpload({
      localUri: recordedUri,
      duration: recordedDuration,
      mimeType: Platform.OS === 'ios' ? 'audio/x-m4a' : 'audio/mp4',
    });
    cleanup();
    onClose();
  };

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheetContainer}>
        <View style={styles.handleBar} />

        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <AppText style={styles.sheetTitle}>
              {state === 'done' ? 'Voice Note Ready' : 'Record Voice Note'}
            </AppText>
            <AppText variant="caption" color={Colors.textSecondary}>
              {state === 'recording'
                ? 'Recording... speak now'
                : state === 'paused'
                ? 'Recording paused'
                : state === 'done'
                ? 'Listen before sending'
                : 'Tap the mic to begin recording'}
            </AppText>
          </View>

          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Animated Spike Lines Waveform Visualizer */}
        <View style={styles.waveformContainer}>
          {barAnims.map((anim, i) => {
            const h = SPIKE_BARS[i];
            const isPlayingBar =
              state === 'done' && isPlayingPreview && i / SPIKE_BARS.length <= previewProgress / recordedDuration;

            return (
              <Animated.View
                key={i}
                style={[
                  styles.spikeBar,
                  {
                    height: h,
                    backgroundColor:
                      state === 'recording'
                        ? Colors.primary
                        : isPlayingBar
                        ? Colors.primary
                        : state === 'done'
                        ? '#5B9E5F'
                        : '#DCD8CE',
                    transform: [{ scaleY: state === 'recording' ? anim : 1 }],
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Timer display */}
        <AppText
          style={[
            styles.timerText,
            state === 'recording' && { color: Colors.primary },
            state === 'done' && { color: '#5B9E5F' },
          ]}
        >
          {formatSecs(state === 'done' ? (isPlayingPreview ? previewProgress : recordedDuration) : duration)}
        </AppText>

        {state !== 'done' ? (
          /* Controls: Discard, Record/Stop, Pause/Resume */
          <View style={styles.controlsRow}>
            {/* Trash button */}
            <TouchableOpacity onPress={handleClose} style={styles.sideControlBtn} hitSlop={8}>
              <Ionicons name="trash-outline" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>

            {/* Main Record/Stop Button */}
            {state === 'idle' ? (
              <TouchableOpacity onPress={startRecording} style={styles.mainRecBtn} activeOpacity={0.85}>
                <View style={styles.recBtnInner} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={stopRecording} style={[styles.mainRecBtn, styles.mainStopBtn]} activeOpacity={0.85}>
                <View style={styles.stopSquare} />
              </TouchableOpacity>
            )}

            {/* Pause / Resume button */}
            {state === 'recording' && (
              <TouchableOpacity onPress={pauseRecording} style={styles.sideControlBtn} hitSlop={8}>
                <Ionicons name="pause-circle-outline" size={28} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
            {state === 'paused' && (
              <TouchableOpacity onPress={resumeRecording} style={styles.sideControlBtn} hitSlop={8}>
                <Ionicons name="play-circle-outline" size={28} color={Colors.primary} />
              </TouchableOpacity>
            )}
            {state === 'idle' && <View style={styles.sideControlBtn} />}
          </View>
        ) : (
          /* Preview and Send Controls */
          <View style={styles.doneControls}>
            <View style={styles.playbackRow}>
              <TouchableOpacity onPress={togglePlaybackPreview} style={styles.playBtn} activeOpacity={0.85}>
                <Ionicons
                  name={isPlayingPreview ? 'pause-circle' : 'play-circle'}
                  size={48}
                  color={Colors.primary}
                />
              </TouchableOpacity>
              <View style={styles.playbackInfo}>
                <AppText style={styles.playbackDurationText}>
                  {formatSecs(recordedDuration)}
                </AppText>
                <AppText variant="caption" color={Colors.textSecondary}>
                  Tap to {isPlayingPreview ? 'pause' : 'preview voice note'}
                </AppText>
              </View>
            </View>

            <View style={styles.doneActionRow}>
              {/* Record again */}
              <TouchableOpacity
                onPress={() => {
                  try {
                    previewPlayerRef.current?.pause();
                    previewPlayerRef.current?.remove();
                    previewPlayerRef.current = null;
                  } catch {}
                  setState('idle');
                  setRecordedUri(null);
                  setDuration(0);
                }}
                style={styles.discardBtn}
              >
                <AppText style={styles.discardText}>Record Again</AppText>
              </TouchableOpacity>

              {/* Send voice note to chat */}
              <TouchableOpacity
                onPress={handleSend}
                style={styles.sendConfirmBtn}
                activeOpacity={0.88}
              >
                <Ionicons name="arrow-up" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <AppText style={styles.sendConfirmText}>Send</AppText>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing[3],
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing[5],
    paddingHorizontal: Spacing[5],
    gap: Spacing[3],
    ...Shadow.md,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DCD8CE',
    alignSelf: 'center',
    marginBottom: Spacing[1],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontFamily: FontFamily.editorial,
    fontSize: FontSize.lg,
    color: '#241B14',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 70,
    paddingVertical: Spacing[2],
  },
  spikeBar: {
    width: 4,
    borderRadius: 2,
  },
  timerText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
  },
  sideControlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainRecBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FDEAE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainStopBtn: {
    backgroundColor: '#FDEAE8',
  },
  recBtnInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#D93838',
  },
  stopSquare: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#D93838',
  },
  doneControls: {
    gap: Spacing[4],
  },
  playbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.xl,
    padding: Spacing[3],
  },
  playBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playbackInfo: {
    flex: 1,
    gap: 2,
  },
  playbackDurationText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  doneActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  discardBtn: {
    flex: 1,
    paddingVertical: Spacing[3],
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardText: {
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  sendConfirmBtn: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: Spacing[3],
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendConfirmText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSize.sm,
  },
});
