import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BlurView } from 'expo-blur';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import { AppText } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize } from '@/theme';

const SCREEN_W = Dimensions.get('window').width;
const MEDIA_W = Math.min(SCREEN_W - 64, 320);

export type AttachmentType = 'image' | 'video' | 'audio';
export type UploadStatus = 'uploading' | 'failed' | 'done';

export interface AttachmentPayload {
  type: 'attachment';
  attachmentType: AttachmentType;
  publicUrl: string;
  key: string;
  mimeType: string;
  caption?: string;
  size?: number;
  duration?: number;
  width?: number;
  height?: number;
}

export function serializeAttachment(payload: Omit<AttachmentPayload, 'type'>): string {
  return JSON.stringify({ type: 'attachment', ...payload });
}

export function parseAttachmentThought(content?: string): AttachmentPayload | null {
  if (!content) return null;
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const data = JSON.parse(trimmed);
    if (data?.type === 'attachment' && data.publicUrl && data.attachmentType) {
      return data as AttachmentPayload;
    }
  } catch {}
  return null;
}

export function formatAttachmentPreview(content: string): string {
  const p = parseAttachmentThought(content);
  if (!p) return content;
  const icons: Record<AttachmentType, string> = { image: '🖼️', video: '🎥', audio: '🎙️' };
  const labels: Record<AttachmentType, string> = { image: 'Photo', video: 'Video', audio: 'Voice Note' };
  const captionText = p.caption ? ` "${p.caption}"` : '';
  return `${icons[p.attachmentType] || '📎'} ${labels[p.attachmentType] || 'Attachment'}${captionText}`;
}

// ── Global reference to currently playing audio note ──────────────────────────
let globalActivePlayer: AudioPlayer | null = null;

// ── Fullscreen Video Player Modal ──────────────────────────────────────────────
function FullscreenVideoModal({ uri, onClose }: { uri: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.fullscreenModal}>
        <SafeAreaView style={styles.fullscreenSafe}>
          <TouchableOpacity onPress={onClose} style={styles.fullscreenCloseBtn} hitSlop={12}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.fullscreenContent}>
            <VideoView
              style={styles.fullscreenVideoPlayer}
              player={player}
              nativeControls
              contentFit="contain"
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ── WhatsApp-style Frosted Glass Upload Overlay with Live MB Progress ─────────
function FrostedGlassUploadOverlay({
  status,
  progress,
  progressText,
  onRetry,
}: {
  status?: UploadStatus;
  progress?: number;
  progressText?: string;
  onRetry?: () => void;
}) {
  if (!status || status === 'done') return null;

  return (
    <View style={styles.glassOverlayContainer} pointerEvents="box-none">
      <BlurView intensity={65} tint="dark" style={styles.glassBadge}>
        {status === 'uploading' ? (
          <View style={styles.glassInnerCol}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <AppText style={styles.progressText}>
              {progressText || (typeof progress === 'number' && progress > 0 ? `${progress}%` : 'Uploading...')}
            </AppText>
          </View>
        ) : (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onRetry?.();
            }}
            activeOpacity={0.7}
            style={styles.glassInnerCol}
            hitSlop={8}
          >
            <Ionicons name="refresh" size={22} color="#FFFFFF" />
            <AppText style={styles.retryText}>Retry</AppText>
          </TouchableOpacity>
        )}
      </BlurView>
    </View>
  );
}

// ── Helper to calculate responsive media dimensions (landscape vs portrait) ─
function getMediaDimensions(width?: number, height?: number) {
  const maxW = MEDIA_W;
  if (!width || !height || width <= 0 || height <= 0) {
    // Default to clean 16:9 landscape
    return { width: maxW, height: Math.round(maxW * 0.5625) };
  }

  const isLandscape = width >= height;
  if (isLandscape) {
    // Landscape media: wide, height matches true aspect ratio
    const aspect = height / width;
    const cardH = Math.round(Math.min(Math.max(maxW * aspect, 140), 220));
    return { width: maxW, height: cardH };
  } else {
    // Portrait media: narrower width, taller height
    const aspect = height / width;
    const cardW = Math.round(maxW * 0.75);
    const cardH = Math.round(Math.min(cardW * aspect, 320));
    return { width: cardW, height: cardH };
  }
}

// ── Image Card (Tappable Lightbox, Frosted Glass Progress, NO BORDERS) ─────────
function ImageCard({
  payload,
  isSelected,
  uploadStatus,
  uploadProgress,
  uploadProgressText,
  onRetry,
}: {
  payload: AttachmentPayload;
  isSelected?: boolean;
  uploadStatus?: UploadStatus;
  uploadProgress?: number;
  uploadProgressText?: string;
  onRetry?: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const { width: cardWidth, height: cardHeight } = getMediaDimensions(payload.width, payload.height);
  const isInteractive = !uploadStatus || uploadStatus === 'done';

  const handlePress = () => {
    if (uploadStatus === 'failed') {
      onRetry?.();
      return;
    }
    if (isInteractive) {
      setFullscreen(true);
    }
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handlePress}
        style={[styles.mediaWrapper, { width: cardWidth, height: cardHeight }]}
      >
        <Image
          source={{ uri: payload.publicUrl }}
          style={styles.mediaImage}
          contentFit="cover"
          transition={250}
        />

        {/* Selection Amber Tint Overlay */}
        {isSelected && (
          <View style={styles.mediaSelectedOverlay} pointerEvents="none" />
        )}

        {/* Center Frosted Glass Progress / Retry Overlay */}
        <FrostedGlassUploadOverlay
          status={uploadStatus}
          progress={uploadProgress}
          progressText={uploadProgressText}
          onRetry={onRetry}
        />
      </TouchableOpacity>

      {/* Fullscreen High-Res Image Lightbox Modal */}
      {fullscreen && (
        <Modal visible={fullscreen} transparent animationType="fade" onRequestClose={() => setFullscreen(false)}>
          <View style={styles.fullscreenModal}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setFullscreen(false)} />
            <SafeAreaView style={styles.fullscreenSafe}>
              <TouchableOpacity onPress={() => setFullscreen(false)} style={styles.fullscreenCloseBtn} hitSlop={12}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.fullscreenContent}>
                <Image
                  source={{ uri: payload.publicUrl }}
                  style={styles.fullscreenImage}
                  contentFit="contain"
                />
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      )}
    </>
  );
}

// ── Video Card (Tappable Player, Frosted Glass Progress, NO BORDERS, NO BADGE) ─
function VideoCard({
  payload,
  isSelected,
  uploadStatus,
  uploadProgress,
  uploadProgressText,
  onRetry,
}: {
  payload: AttachmentPayload;
  isSelected?: boolean;
  uploadStatus?: UploadStatus;
  uploadProgress?: number;
  uploadProgressText?: string;
  onRetry?: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const { width: cardWidth, height: cardHeight } = getMediaDimensions(payload.width, payload.height);
  const isInteractive = !uploadStatus || uploadStatus === 'done';

  const handlePress = () => {
    if (uploadStatus === 'failed') {
      onRetry?.();
      return;
    }
    if (isInteractive) {
      setFullscreen(true);
    }
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handlePress}
        style={[styles.mediaWrapper, { width: cardWidth, height: cardHeight }]}
      >
        <Image
          source={{ uri: payload.publicUrl }}
          style={styles.mediaImage}
          contentFit="cover"
          transition={200}
        />

        {/* Selection Amber Tint Overlay */}
        {isSelected && (
          <View style={styles.mediaSelectedOverlay} pointerEvents="none" />
        )}

        {/* Video Overlay with Center Play Button (NO VIDEO BADGE per user request) */}
        {isInteractive && (
          <View style={styles.videoOverlay}>
            <View style={styles.playCircle}>
              <Ionicons name="play" size={26} color="#FFFFFF" style={{ marginLeft: 3 }} />
            </View>
          </View>
        )}

        {/* Center Frosted Glass Progress / Retry Overlay with Live MB */}
        <FrostedGlassUploadOverlay
          status={uploadStatus}
          progress={uploadProgress}
          progressText={uploadProgressText}
          onRetry={onRetry}
        />
      </TouchableOpacity>

      {/* Fullscreen Video Player Modal */}
      {fullscreen && (
        <FullscreenVideoModal
          uri={payload.publicUrl}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  );
}

// ── Audio Card (Real Playback, Interactive Waveform, Retry, NO BORDERS) ────────
const SPIKE_HEIGHTS = [12, 18, 28, 38, 26, 16, 22, 34, 42, 32, 20, 26, 36, 28, 18, 24, 38, 30, 20, 14];

function AudioCard({
  payload,
  isSelected,
  uploadStatus,
  uploadProgressText,
  onRetry,
}: {
  payload: AttachmentPayload;
  isSelected: boolean;
  uploadStatus?: UploadStatus;
  uploadProgressText?: string;
  onRetry?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [trackDuration, setTrackDuration] = useState(payload.duration || 0);

  const playerRef = useRef<AudioPlayer | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Cleanup player when component unmounts
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          if (globalActivePlayer === playerRef.current) {
            globalActivePlayer = null;
          }
          playerRef.current.pause();
          playerRef.current.remove();
        } catch {}
        playerRef.current = null;
      }
    };
  }, []);

  // Dancing pulse animation during active playback
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (isPlaying) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 300, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 300, useNativeDriver: true }),
        ])
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => loop?.stop();
  }, [isPlaying]);

  // ── Real Audio Playback Handling with expo-audio ─────────────────────────────
  const togglePlay = async () => {
    if (uploadStatus === 'failed') {
      onRetry?.();
      return;
    }
    if (uploadStatus === 'uploading') return;

    if (isPlaying) {
      try {
        playerRef.current?.pause();
      } catch {}
      setIsPlaying(false);
      if (globalActivePlayer === playerRef.current) {
        globalActivePlayer = null;
      }
    } else {
      try {
        // Stop any previously playing audio note
        if (globalActivePlayer && globalActivePlayer !== playerRef.current) {
          try {
            globalActivePlayer.pause();
          } catch {}
        }

        // Configure system audio for loud speaker playback even in silent mode
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });

        if (!playerRef.current) {
          playerRef.current = createAudioPlayer(payload.publicUrl, { downloadFirst: true });
          playerRef.current.addListener('playbackStatusUpdate', (status) => {
            if (status.currentTime !== undefined) {
              setPlayProgress(Math.floor(status.currentTime));
            }
            if (status.duration !== undefined && status.duration > 0) {
              setTrackDuration(Math.round(status.duration));
            }
            if (status.playing !== undefined) {
              setIsPlaying(status.playing);
            }

            // Track completion handling
            const totalDur = status.duration || trackDuration || payload.duration || 1;
            if (status.currentTime >= totalDur && !status.playing) {
              setIsPlaying(false);
              setPlayProgress(0);
              try {
                playerRef.current?.seekTo(0);
              } catch {}
              if (globalActivePlayer === playerRef.current) {
                globalActivePlayer = null;
              }
            }
          });
        }

        globalActivePlayer = playerRef.current;
        playerRef.current.play();
        setIsPlaying(true);
      } catch (err: any) {
        console.warn('Voice note playback error:', err?.message || err);
        setIsPlaying(false);
      }
    }
  };

  const formatDur = (secs?: number) => {
    const s = secs || 0;
    const m = Math.floor(s / 60);
    const rem = String(s % 60).padStart(2, '0');
    return `${m}:${rem}`;
  };

  const activeColor = isSelected ? '#FFFFFF' : Colors.primary;
  const inactiveColor = isSelected ? 'rgba(255, 255, 255, 0.45)' : '#D6D2C8';
  const textColor = isSelected ? '#FFFFFF' : Colors.text;
  const subColor = isSelected ? 'rgba(255, 255, 255, 0.88)' : Colors.textSecondary;

  const totalTime = trackDuration || payload.duration || 6;

  return (
    <View
      style={[
        styles.audioCard,
        {
          backgroundColor: isSelected ? Colors.primary : '#F3F1EE',
        },
      ]}
    >
      {/* Play / Upload / Retry Button */}
      <TouchableOpacity onPress={togglePlay} activeOpacity={0.85} style={styles.audioPlayBtn}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View
            style={[
              styles.audioPlayInner,
              {
                backgroundColor:
                  uploadStatus === 'failed'
                    ? '#D93838'
                    : isSelected
                    ? '#FFFFFF'
                    : Colors.primary,
              },
            ]}
          >
            {uploadStatus === 'uploading' ? (
              <ActivityIndicator size="small" color={isSelected ? Colors.primary : '#FFFFFF'} />
            ) : uploadStatus === 'failed' ? (
              <Ionicons name="refresh" size={18} color={isSelected ? Colors.primary : '#FFFFFF'} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={18}
                color={isSelected ? Colors.primary : '#FFFFFF'}
                style={!isPlaying ? { marginLeft: 2 } : undefined}
              />
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>

      {/* Spike Lines (Audio Waveform) */}
      <View style={styles.spikeLinesContainer}>
        {SPIKE_HEIGHTS.map((h, i) => {
          const progressPercent = totalTime > 0 ? playProgress / totalTime : 0;
          const barPercent = i / SPIKE_HEIGHTS.length;
          const isPassed = isPlaying && barPercent <= progressPercent;

          return (
            <View
              key={i}
              style={[
                styles.spikeBar,
                {
                  height: h,
                  backgroundColor: isPassed ? activeColor : inactiveColor,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Duration Label / Live MB progress during upload */}
      <View style={styles.audioDurationCol}>
        <AppText style={[styles.audioDurText, { color: textColor }]}>
          {formatDur(isPlaying ? playProgress : totalTime)}
        </AppText>
        <AppText
          variant="caption"
          style={[
            styles.audioLabel,
            { color: uploadStatus === 'failed' ? '#D93838' : subColor },
          ]}
        >
          {uploadStatus === 'uploading'
            ? uploadProgressText || 'Uploading...'
            : uploadStatus === 'failed'
            ? 'Failed • Retry'
            : isPlaying
            ? 'Playing'
            : 'Voice Note'}
        </AppText>
      </View>
    </View>
  );
}

// ── Main exported AttachmentCard ───────────────────────────────────────────────
export function AttachmentCard({
  payload,
  isSelected,
  uploadStatus,
  uploadProgress,
  uploadProgressText,
  onRetry,
}: {
  payload: AttachmentPayload;
  isSelected: boolean;
  uploadStatus?: UploadStatus;
  uploadProgress?: number;
  uploadProgressText?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.container}>
      {payload.attachmentType === 'image' && (
        <ImageCard
          payload={payload}
          isSelected={isSelected}
          uploadStatus={uploadStatus}
          uploadProgress={uploadProgress}
          uploadProgressText={uploadProgressText}
          onRetry={onRetry}
        />
      )}
      {payload.attachmentType === 'video' && (
        <VideoCard
          payload={payload}
          isSelected={isSelected}
          uploadStatus={uploadStatus}
          uploadProgress={uploadProgress}
          uploadProgressText={uploadProgressText}
          onRetry={onRetry}
        />
      )}
      {payload.attachmentType === 'audio' && (
        <AudioCard
          payload={payload}
          isSelected={isSelected}
          uploadStatus={uploadStatus}
          uploadProgressText={uploadProgressText}
          onRetry={onRetry}
        />
      )}

      {/* WhatsApp-style Caption under media */}
      {Boolean(payload.caption) && (
        <View style={styles.captionBox}>
          <AppText
            variant="body"
            color={Colors.text}
            style={styles.captionText}
          >
            {payload.caption}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 0,
    borderWidth: 0, // NO BORDERS
  },
  mediaWrapper: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#EAE6DF',
    position: 'relative',
    borderWidth: 0, // NO BORDERS
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaSelectedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(245, 166, 35, 0.25)',
    borderRadius: Radius.lg,
    zIndex: 5,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.68)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  durationText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
  },

  // ── WhatsApp-Style Center Frosted Glass Upload Overlay with Live MB Progress ──
  glassOverlayContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    zIndex: 10,
  },
  glassBadge: {
    minWidth: 84,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(18, 18, 20, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  glassInnerCol: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  progressText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  retryText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.3,
  },

  // ── Fullscreen Lightbox / Player Modal ───────────────────
  fullscreenModal: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullscreenSafe: {
    flex: 1,
    justifyContent: 'space-between',
  },
  fullscreenContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenVideoPlayer: {
    width: '100%',
    height: '100%',
  },
  fullscreenCloseBtn: {
    alignSelf: 'flex-end',
    marginRight: Spacing[4],
    marginTop: Spacing[2],
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // ── Caption Box (WhatsApp style) ─────────────────────────
  captionBox: {
    paddingTop: Spacing[2],
    paddingHorizontal: 4,
  },
  captionText: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },

  // ── Audio Spike Lines Card (NO BORDERS) ──────────────────
  audioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    borderRadius: Radius.lg,
    borderWidth: 0, // NO BORDERS
    paddingHorizontal: Spacing[3],
    paddingVertical: 10,
    minWidth: 240,
    maxWidth: MEDIA_W,
  },
  audioPlayBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlayInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spikeLinesContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 44,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  spikeBar: {
    width: 3,
    borderRadius: 1.5,
  },
  audioDurationCol: {
    alignItems: 'flex-end',
    gap: 1,
    paddingLeft: 2,
  },
  audioDurText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
  },
  audioLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
