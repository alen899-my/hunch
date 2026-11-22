import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  useWindowDimensions,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { AppText } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize, Shadow } from '@/theme';
import { useDayStream } from '@/hooks/use-thoughts';
import type { Thought } from '@/services/thoughts.service';
import { uploadToR2 } from '@/services/upload.service';
import { CustomCameraModal, CameraResult } from '../components/CustomCameraModal';
import { AudioRecorderModal } from '../components/AudioRecorderModal';
import type { AudioUploadResult } from '../components/AudioRecorderModal';
import { MediaPreviewModal, PendingMedia } from '../components/MediaPreviewModal';
import {
  AttachmentCard,
  parseAttachmentThought,
  serializeAttachment,
  formatAttachmentPreview,
} from '../components/AttachmentCard';

export interface UploadJob {
  tempId: string;
  media?: PendingMedia;
  audioResult?: AudioUploadResult;
  caption?: string;
  status: 'uploading' | 'failed' | 'done';
  progress: number;
  progressText?: string;
}

const TABLET = 600;

function formatTime(isoStr: string) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ThoughtChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dayDate = typeof id === 'string' ? id : new Date().toISOString().split('T')[0];

  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET;
  const isSmallPhone = width < 370;
  const maxW = isTablet ? 580 : undefined;

  const { thoughts, loading, addThought, removeThought, removeThoughts, fetchThoughts } =
    useDayStream(dayDate);
  const [text, setText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showCustomCamera, setShowCustomCamera] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [optimisticThoughts, setOptimisticThoughts] = useState<Thought[]>([]);
  const [uploadJobs, setUploadJobs] = useState<Record<string, UploadJob>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const scrollViewRef = useRef<any>(null);

  // Send / Mic button bounce animation
  const actionScale = useRef(new Animated.Value(1)).current;

  const isSelectionMode = selectedIds.length > 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchThoughts();
    setRefreshing(false);
  };

  // Combine confirmed thoughts + optimistic chat items (instant WhatsApp feel)
  const displayThoughts = [
    ...thoughts,
    ...optimisticThoughts.filter((opt) => !thoughts.some((t) => t.id === opt.id)),
  ];

  // ── Custom in-app camera capture: open WhatsApp-style preview with caption ─
  const handleCustomCameraCapture = (result: CameraResult) => {
    setShowCustomCamera(false);
    setPendingMedia({
      uri: result.uri,
      type: result.type === 'video' ? 'video' : 'image',
      mimeType: result.mimeType,
      width: result.width,
      height: result.height,
      duration: result.duration,
    });
  };

  // ── Direct device gallery selection: open WhatsApp-style preview with caption ─
  const handlePickFromGallery = async () => {
    setShowAttachmentMenu(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Gallery access needed', 'Please allow gallery access to select photos or videos.');
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.85,
        allowsMultipleSelection: false,
      });

      if (picked.canceled || !picked.assets || picked.assets.length === 0) return;

      const asset = picked.assets[0];
      const isVideo = asset.type === 'video' || asset.mimeType?.startsWith('video/');
      const category = isVideo ? 'video' : 'image';
      const mimeType = asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');

      setPendingMedia({
        uri: asset.uri,
        type: category,
        mimeType,
        width: asset.width,
        height: asset.height,
        duration: asset.duration ? Math.round(asset.duration / 1000) : undefined,
      });
    } catch (err: any) {
      Alert.alert('Gallery error', err?.message || 'Could not select media.');
    }
  };

  // ── Background Upload Runner for Media (Photo/Video) with Live Progress ──
  const startMediaUpload = async (tempId: string, media: PendingMedia, caption?: string) => {
    setUploadJobs((prev) => ({
      ...prev,
      [tempId]: { tempId, media, caption, status: 'uploading', progress: 5, progressText: 'Starting...' },
    }));

    try {
      const uploadRes = await uploadToR2(media.uri, media.mimeType, (info) => {
        setUploadJobs((prev) => {
          if (!prev[tempId]) return prev;
          return {
            ...prev,
            [tempId]: {
              ...prev[tempId],
              progress: info.percent,
              progressText: info.formattedProgress,
            },
          };
        });
      });

      const finalPayload = serializeAttachment({
        attachmentType: media.type,
        publicUrl: uploadRes.publicUrl,
        key: uploadRes.key,
        mimeType: uploadRes.mimeType,
        caption: caption || undefined,
        width: media.width,
        height: media.height,
        duration: media.duration,
      });

      const saved = await addThought(finalPayload, media.type);
      if (saved) {
        setOptimisticThoughts((prev) => prev.filter((t) => t.id !== tempId));
        setUploadJobs((prev) => {
          const next = { ...prev };
          delete next[tempId];
          return next;
        });
      }
    } catch {
      setUploadJobs((prev) => {
        if (!prev[tempId]) return prev;
        return { ...prev, [tempId]: { ...prev[tempId], status: 'failed' } };
      });
    }
  };

  // ── Background Upload Runner for Voice Note Audio with Live Progress ────
  const startAudioUpload = async (tempId: string, result: AudioUploadResult) => {
    setUploadJobs((prev) => ({
      ...prev,
      [tempId]: { tempId, audioResult: result, status: 'uploading', progress: 5, progressText: 'Starting...' },
    }));

    try {
      const uploadRes = await uploadToR2(result.localUri, result.mimeType, (info) => {
        setUploadJobs((prev) => {
          if (!prev[tempId]) return prev;
          return {
            ...prev,
            [tempId]: {
              ...prev[tempId],
              progress: info.percent,
              progressText: info.formattedProgress,
            },
          };
        });
      });

      const finalPayload = serializeAttachment({
        attachmentType: 'audio',
        publicUrl: uploadRes.publicUrl,
        key: uploadRes.key,
        mimeType: uploadRes.mimeType,
        size: result.size,
        duration: result.duration,
      });

      const saved = await addThought(finalPayload, 'audio');
      if (saved) {
        setOptimisticThoughts((prev) => prev.filter((t) => t.id !== tempId));
        setUploadJobs((prev) => {
          const next = { ...prev };
          delete next[tempId];
          return next;
        });
      }
    } catch {
      setUploadJobs((prev) => {
        if (!prev[tempId]) return prev;
        return { ...prev, [tempId]: { ...prev[tempId], status: 'failed' } };
      });
    }
  };

  // ── Retry an upload directly from the chat card or footer ────────────────
  const handleRetryUpload = (tempId: string) => {
    const job = uploadJobs[tempId];
    if (!job) return;
    if (job.media) {
      startMediaUpload(tempId, job.media, job.caption);
    } else if (job.audioResult) {
      startAudioUpload(tempId, job.audioResult);
    }
  };

  // ── Send media from WhatsApp preview: sent instantly to chat ────────────
  const handleMediaPreviewSend = (media: PendingMedia, caption: string) => {
    setPendingMedia(null);

    const tempId = `temp_${Date.now()}`;
    const tempPayload = serializeAttachment({
      attachmentType: media.type,
      publicUrl: media.uri,
      key: 'temp',
      mimeType: media.mimeType,
      caption: caption || undefined,
      width: media.width,
      height: media.height,
      duration: media.duration,
    });

    const tempThought: Thought = {
      id: tempId,
      user_id: '',
      day_date: dayDate,
      content: tempPayload,
      category: media.type,
      created_at: new Date().toISOString(),
    };

    setOptimisticThoughts((prev) => [...prev, tempThought]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    startMediaUpload(tempId, media, caption);
  };

  // ── Audio recording uploaded: sent instantly to chat ─────────────────────
  const handleAudioUploaded = (result: AudioUploadResult) => {
    setShowAudioRecorder(false);

    const tempId = `temp_${Date.now()}`;
    const tempPayload = serializeAttachment({
      attachmentType: 'audio',
      publicUrl: result.localUri || result.publicUrl || '',
      key: 'temp',
      mimeType: result.mimeType,
      size: result.size,
      duration: result.duration,
    });

    const tempThought: Thought = {
      id: tempId,
      user_id: '',
      day_date: dayDate,
      content: tempPayload,
      category: 'audio',
      created_at: new Date().toISOString(),
    };

    setOptimisticThoughts((prev) => [...prev, tempThought]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    startAudioUpload(tempId, result);
  };

  // ── Text send: sent instantly to chat ────────────────────────────────────
  const handleSend = async () => {
    if (!text.trim()) return;

    Animated.sequence([
      Animated.timing(actionScale, { toValue: 0.82, duration: 80, useNativeDriver: true }),
      Animated.spring(actionScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    const content = text.trim();
    setText(''); // Instant clear like WhatsApp

    const tempId = `temp_${Date.now()}`;
    const tempThought: Thought = {
      id: tempId,
      user_id: '',
      day_date: dayDate,
      content,
      category: 'thinking',
      created_at: new Date().toISOString(),
    };

    setOptimisticThoughts((prev) => [...prev, tempThought]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      await addThought(content, 'thinking');
    } catch {
      Alert.alert('Could not save thought', 'Please check your connection and try again.');
    } finally {
      setOptimisticThoughts((prev) => prev.filter((t) => t.id !== tempId));
    }
  };

  const handleVoicePress = () => {
    // Open audio recorder
    setShowAudioRecorder(true);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/thoughts' as any);
    }
  };

  // WhatsApp-style Selection Handlers
  const handleLongPressThought = (id: string) => {
    if (!selectedIds.includes(id)) {
      setSelectedIds((prev) => [...prev, id]);
    }
  };

  const handleToggleSelectThought = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Thanos Snap Wipe Disappearing Delete Execution
  const executeThanosWipeDelete = (idsToDelete: string[]) => {
    setDeletingIds(idsToDelete);
    setTimeout(async () => {
      setSelectedIds([]);
      setDeletingIds([]);
      if (idsToDelete.length === 1) {
        await removeThought(idsToDelete[0]);
      } else {
        await removeThoughts(idsToDelete);
      }
    }, 340);
  };

  // Header Delete Action (works both in selection mode & normal mode)
  const handleDeletePress = () => {
    if (isSelectionMode) {
      const count = selectedIds.length;
      Alert.alert(
        count === 1 ? 'Delete thought?' : `Delete ${count} thoughts?`,
        count === 1
          ? 'Are you sure you want to delete this thought?'
          : `Are you sure you want to delete these ${count} thoughts?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => executeThanosWipeDelete([...selectedIds]),
          },
        ]
      );
    } else {
      if (thoughts.length === 0) {
        Alert.alert('No thoughts', 'There are no thoughts to delete for this day.');
        return;
      }
      Alert.alert(
        'Delete options',
        'Choose how you want to delete thoughts for today:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Select Thoughts',
            onPress: () => {
              if (thoughts.length > 0) {
                setSelectedIds([thoughts[thoughts.length - 1].id]);
              }
            },
          },
          {
            text: 'Clear All Today',
            style: 'destructive',
            onPress: () => {
              const allIds = thoughts.map((t) => t.id);
              executeThanosWipeDelete(allIds);
            },
          },
        ]
      );
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ── 4. Clean Top Bar: ONLY Back, Calendar & Delete (No Today • Sat Nov text) ── */}
      <View
        style={[
          styles.topBar,
          isSelectionMode && styles.topBarSelection,
          maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
        ]}
      >
        {/* Left: Back button or Close selection */}
        {isSelectionMode ? (
          <TouchableOpacity
            onPress={handleClearSelection}
            style={styles.headerGhostBtn}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.headerBtn}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        )}

        {/* Center: Clean Spacer / Selection count (NO "Today • Sat Nov" text) */}
        <View style={styles.topCenter}>
          {isSelectionMode && (
            <AppText variant="title" style={styles.selectionTitle}>
              {selectedIds.length} selected
            </AppText>
          )}
        </View>

        {/* Right Actions: Calendar (in normal mode) OR Pure Delete Icon (ONLY when selected) */}
        <View style={styles.headerRightRow}>
          {isSelectionMode ? (
            <TouchableOpacity
              onPress={handleDeletePress}
              style={styles.headerDeleteBtn}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Feather name="trash-2" size={22} color="#D93838" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.headerBtn}
              hitSlop={8}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/thoughts' as any)}
            >
              <Ionicons name="calendar-outline" size={19} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Keyboard Avoiding Main Chat Stream ───── */}
      <KeyboardAvoidingView
        style={styles.keyboardFlex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* ── 3. Fast Skeleton Loader when initially loading ── */}
        {loading && thoughts.length === 0 ? (
          <ChatSkeletonLoader maxW={maxW} />
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            bounces={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
            onContentSizeChange={() => {
              if (!isSelectionMode) {
                scrollViewRef.current?.scrollToEnd({ animated: false });
              }
            }}
          >
            {displayThoughts.length === 0 ? (
              <View style={styles.emptyState}>
                <Image
                  source={require('../../../../assets/images/empty-thoughts.png')}
                  style={styles.emptyChatIllustration}
                  resizeMode="contain"
                />
                <AppText style={styles.emptyChatTitle}>
                  No thoughts yet
                </AppText>
                <AppText
                  variant="body"
                  color={Colors.textSecondary}
                  align="center"
                  style={styles.emptyStateText}
                >
                  Type a message below to save a thought for this day.
                </AppText>
              </View>
            ) : (
              displayThoughts.map((t, idx) => (
                <AnimatedThoughtCard
                  key={t.id || idx}
                  thought={t}
                  isSelected={selectedIds.includes(t.id)}
                  isSelectionMode={isSelectionMode}
                  isDeleting={deletingIds.includes(t.id)}
                  uploadJob={uploadJobs[t.id]}
                  onRetry={() => handleRetryUpload(t.id)}
                  onLongPress={() => handleLongPressThought(t.id)}
                  onToggleSelect={() => handleToggleSelectThought(t.id)}
                />
              ))
            )}
          </ScrollView>
        )}

        {/* ── Attachment Popup Sheet (Single Direct Action Tray — No Duplicate Pickers) ── */}
        {showAttachmentMenu && (
          <View
            style={[
              styles.attachmentTray,
              maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
            ]}
          >
            <View style={styles.attachmentRow}>
              {/* 1. Custom In-App Camera (Photos & Videos — NEVER phone default camera) */}
              <TouchableOpacity
                onPress={() => {
                  setShowAttachmentMenu(false);
                  setShowCustomCamera(true);
                }}
                activeOpacity={0.8}
                style={styles.attachmentItem}
              >
                <View style={[styles.attachmentCircle, { backgroundColor: '#E8EFF8' }]}>
                  <Ionicons name="camera" size={24} color="#3D6B9E" />
                </View>
                <AppText variant="caption" style={styles.attachmentLabel}>
                  Camera
                </AppText>
              </TouchableOpacity>

              {/* 2. Direct Device Gallery (Photos & Videos — No duplicate menu) */}
              <TouchableOpacity
                onPress={handlePickFromGallery}
                activeOpacity={0.8}
                style={styles.attachmentItem}
              >
                <View style={[styles.attachmentCircle, { backgroundColor: '#EDE8F7' }]}>
                  <Ionicons name="images" size={24} color="#6E5AAB" />
                </View>
                <AppText variant="caption" style={styles.attachmentLabel}>
                  Gallery
                </AppText>
              </TouchableOpacity>

              {/* 3. Custom Audio Voice Recorder (Dancing Spike Lines Waveform) */}
              <TouchableOpacity
                onPress={() => {
                  setShowAttachmentMenu(false);
                  setShowAudioRecorder(true);
                }}
                activeOpacity={0.8}
                style={styles.attachmentItem}
              >
                <View style={[styles.attachmentCircle, { backgroundColor: '#FDF3E0' }]}>
                  <Ionicons name="mic" size={24} color={Colors.primary} />
                </View>
                <AppText variant="caption" style={styles.attachmentLabel}>
                  Audio
                </AppText>
              </TouchableOpacity>

              {/* 4. Close Tray */}
              <TouchableOpacity
                onPress={() => setShowAttachmentMenu(false)}
                activeOpacity={0.8}
                style={styles.attachmentItem}
              >
                <View style={[styles.attachmentCircle, { backgroundColor: Colors.surfaceAlt }]}>
                  <Ionicons name="close" size={24} color={Colors.textSecondary} />
                </View>
                <AppText variant="caption" style={styles.attachmentLabel}>
                  Close
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Bottom Thought Bar (WhatsApp Layout) ─── */}
        <View
          style={[
            styles.bottomBarWrapper,
            maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
          ]}
        >
          <View style={styles.chatRow}>
            {/* Left Pill: Attachment Paperclip + Text Input */}
            <View style={styles.inputPill}>
              <TouchableOpacity
                onPress={() => setShowAttachmentMenu(!showAttachmentMenu)}
                style={styles.attachBtn}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showAttachmentMenu ? 'close-circle' : 'attach-outline'}
                  size={23}
                  color={showAttachmentMenu ? Colors.primary : Colors.textSecondary}
                />
              </TouchableOpacity>

              {/* Text Input */}
              <TextInput
                placeholder="Type a thought..."
                placeholderTextColor={Colors.textMuted}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={1200}
                style={[styles.textInput, isSmallPhone && { fontSize: FontSize.sm }]}
              />
            </View>

            {/* Right Side: Voice Mic (when empty) OR Send Button (when typing) */}
            <Animated.View style={{ transform: [{ scale: actionScale }] }}>
              {hasText ? (
                // Send Button: Instant chat sending (no submit blocking!)
                <TouchableOpacity
                  onPress={handleSend}
                  activeOpacity={0.85}
                  style={[styles.actionCircle, styles.actionSend]}
                >
                  <Ionicons name="arrow-up" size={20} color={Colors.white} />
                </TouchableOpacity>
              ) : (
                // Voice Mic Button — opens audio recorder
                <TouchableOpacity
                  onPress={handleVoicePress}
                  activeOpacity={0.85}
                  style={[styles.actionCircle, styles.actionMic]}
                >
                  <Ionicons name="mic" size={20} color={Colors.white} />
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── WhatsApp-Style Media Preview Modal (Preview + Caption before sending) ── */}
      <MediaPreviewModal
        visible={Boolean(pendingMedia)}
        media={pendingMedia}
        onClose={() => setPendingMedia(null)}
        onSend={handleMediaPreviewSend}
      />

      {/* ── Custom In-App Camera Modal (Photo & Video) — Never device default camera ── */}
      <CustomCameraModal
        visible={showCustomCamera}
        onClose={() => setShowCustomCamera(false)}
        onCapture={handleCustomCameraCapture}
      />

      {/* ── Custom Audio Recorder Modal (Dancing Spike Lines Waveform) ── */}
      <AudioRecorderModal
        visible={showAudioRecorder}
        onClose={() => setShowAudioRecorder(false)}
        onUpload={handleAudioUploaded}
      />
    </SafeAreaView>
  );
}

// ── 5. Animated Thought Bubble Card (Appearing & Thanos Snap Wipe Animation) ──
function AnimatedThoughtCard({
  thought,
  isSelected,
  isSelectionMode,
  isDeleting,
  uploadJob,
  onRetry,
  onLongPress,
  onToggleSelect,
}: {
  thought: Thought;
  isSelected: boolean;
  isSelectionMode: boolean;
  isDeleting: boolean;
  uploadJob?: UploadJob;
  onRetry?: () => void;
  onLongPress: () => void;
  onToggleSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const attachmentPayload = parseAttachmentThought(thought.content);
  const isAttachment = Boolean(attachmentPayload);
  const isLong = !isAttachment && thought.content.length > 150;

  // Animation values
  const animOpacity = useRef(new Animated.Value(0)).current;
  const animTranslateY = useRef(new Animated.Value(28)).current;
  const animTranslateX = useRef(new Animated.Value(0)).current;
  const animScale = useRef(new Animated.Value(0.72)).current;

  // 5. Appearing Spring Animation on chat send/mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(animOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.spring(animScale, {
        toValue: 1,
        friction: 5,
        tension: 75,
        useNativeDriver: true,
      }),
      Animated.spring(animTranslateY, {
        toValue: 0,
        friction: 6,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // 5. Thanos Disappearing Wipe Animation when isDeleting
  useEffect(() => {
    if (isDeleting) {
      Animated.parallel([
        Animated.timing(animOpacity, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(animTranslateX, {
          toValue: 70, // dissolves and drifts to the right like dust
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(animTranslateY, {
          toValue: -14, // floats up into dust
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(animScale, {
          toValue: 0.65, // shrinks down
          duration: 320,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isDeleting]);

  const handlePress = () => {
    if (isSelectionMode) {
      onToggleSelect();
    } else if (isLong) {
      setExpanded(!expanded);
    }
  };

  return (
    <Animated.View
      style={[
        styles.thoughtCardWrapper,
        {
          opacity: animOpacity,
          transform: [
            { translateY: animTranslateY },
            { translateX: animTranslateX },
            { scale: animScale },
          ],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        delayLongPress={220}
        onLongPress={onLongPress}
        onPress={handlePress}
        style={[
          styles.thoughtCard,
          isAttachment && styles.thoughtCardAttachment,
          isSelected && (isAttachment ? styles.thoughtCardAttachmentSelected : styles.thoughtCardSelected),
        ]}
      >
        {/* Large Checkmark Indicator Badge */}
        {isSelected && (
          <View style={styles.selectedBadge}>
            <View style={styles.selectedBadgeInner}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
            </View>
          </View>
        )}

        {isAttachment && attachmentPayload ? (
          /* ── Attachment: Image / Video / Audio (with frosted glass progress & retry) ── */
          <>
            <AttachmentCard
              payload={attachmentPayload}
              isSelected={isSelected}
              uploadStatus={uploadJob?.status}
              uploadProgress={uploadJob?.progress}
              uploadProgressText={uploadJob?.progressText}
              onRetry={onRetry}
            />
            <View style={styles.thoughtFooter}>
              <AppText
                variant="caption"
                color={isSelected ? 'rgba(255, 255, 255, 0.9)' : Colors.textMuted}
                style={[styles.timeText, isSelected && styles.timeTextSelected]}
              >
                {formatTime(thought.created_at)}
              </AppText>
              {uploadJob?.status === 'uploading' && (
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={isSelected ? 'rgba(255, 255, 255, 0.8)' : Colors.textMuted}
                  style={{ marginLeft: 3 }}
                />
              )}
              {uploadJob?.status === 'failed' && (
                <TouchableOpacity onPress={onRetry} hitSlop={8} style={{ marginLeft: 3 }}>
                  <Ionicons name="alert-circle" size={13} color="#D93838" />
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          /* ── Standard Text Thought ── */
          <>
            {/* Content Body (Pure white when solid filled selected) */}
            <AppText
              variant="body"
              color={isSelected ? Colors.white : Colors.text}
              numberOfLines={expanded ? undefined : 6}
              style={[styles.thoughtBodyText, isSelected && styles.thoughtBodyTextSelected]}
            >
              {thought.content}
            </AppText>

            {/* Read More / Read Less Toggle */}
            {isLong && (
              <TouchableOpacity
                onPress={() => setExpanded(!expanded)}
                activeOpacity={0.7}
                style={styles.readMoreRow}
              >
                <AppText
                  variant="caption"
                  color={isSelected ? Colors.white : Colors.primaryDark}
                  style={{ fontFamily: FontFamily.bold }}
                >
                  {expanded ? 'Show less' : 'Read more'}
                </AppText>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color={isSelected ? Colors.white : Colors.primaryDark}
                />
              </TouchableOpacity>
            )}

            {/* Footer row: Clean Time */}
            <View style={styles.thoughtFooter}>
              <AppText
                variant="caption"
                color={isSelected ? 'rgba(255, 255, 255, 0.9)' : Colors.textMuted}
                style={[styles.timeText, isSelected && styles.timeTextSelected]}
              >
                {formatTime(thought.created_at)}
              </AppText>
              {thought.id?.startsWith('temp_') && (
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={isSelected ? 'rgba(255, 255, 255, 0.8)' : Colors.textMuted}
                  style={{ marginLeft: 3 }}
                />
              )}
            </View>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── 3. Sleek Shimmering Skeleton Loader ──────────────────────
function ChatSkeletonLoader({ maxW }: { maxW?: number }) {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.82, duration: 650, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <View
      style={[
        styles.skeletonContainer,
        maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
      ]}
    >
      {[86, 62, 94].map((w, idx) => (
        <Animated.View key={idx} style={[styles.skeletonCard, { opacity: pulseAnim }]}>
          <View style={[styles.skeletonLine, { width: `${w}%` }]} />
          <View style={[styles.skeletonLine, { width: `${w * 0.58}%`, marginTop: 8 }]} />
          <View style={styles.skeletonFooter}>
            <View style={styles.skeletonTime} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardFlex: {
    flex: 1,
  },

  // ── 4. Clean Top Bar (Only Back, Calendar, and Delete) ───────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#EFECE6',
    backgroundColor: Colors.background,
  },
  topBarSelection: {
    backgroundColor: '#FFFDF9',
    borderBottomColor: '#EADECE',
  },
  topCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing[2],
  },
  selectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ECEAE4',
    ...Shadow.xs,
  },
  headerGhostBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  headerDeleteBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },

  // ── Main stream ───────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[8],
    gap: Spacing[3],
  },
  emptyState: {
    paddingVertical: Spacing[8],
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
  },
  emptyChatIllustration: {
    width: 145,
    height: 120,
    marginBottom: Spacing[1],
  },
  emptyChatTitle: {
    fontFamily: FontFamily.editorial,
    fontSize: 20,
    color: '#241B14',
    textAlign: 'center',
  },
  emptyStateText: {
    width: '100%',
    maxWidth: 290,
    lineHeight: 21,
    textAlign: 'center',
  },

  // ── 3. Skeleton Loader ─────────────────────────────
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[4],
    gap: Spacing[3],
  },
  skeletonCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    padding: Spacing[4],
    borderWidth: 1.5,
    borderColor: '#ECEAE4',
    gap: Spacing[2],
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EAE6DF',
  },
  skeletonFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing[2],
  },
  skeletonTime: {
    width: 44,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EAE6DF',
  },

  // ── Thought Card (with WhatsApp style highlight) ─
  thoughtCardWrapper: {
    width: '100%',
  },
  thoughtCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    gap: Spacing[2],
    shadowColor: '#2B261F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
  },
  thoughtCardAttachment: {
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 0, // ZERO PADDING: no white border around media!
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  thoughtCardSelected: {
    backgroundColor: Colors.primary, // Solid Fill Amber Colored BG
    borderWidth: 0, // NO BORDER
    borderColor: 'transparent',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  thoughtCardAttachmentSelected: {
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 0,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 5,
  },
  selectedBadgeInner: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thoughtBodyTextSelected: {
    color: '#FFFFFF',
    fontFamily: FontFamily.medium,
  },
  timeTextSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  thoughtFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 4,
  },
  timeText: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: Colors.textMuted,
  },
  thoughtBodyText: {
    lineHeight: 22,
    fontSize: FontSize.md,
  },
  readMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },

  // ── WhatsApp-style Attachment Tray ────────────────
  attachmentTray: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing[4],
    marginBottom: Spacing[2],
    borderRadius: Radius['2xl'],
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[5],
    borderWidth: 1.5,
    borderColor: '#ECEAE4',
    ...Shadow.md,
  },
  attachmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  attachmentItem: {
    alignItems: 'center',
    gap: 6,
  },
  attachmentCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.xs,
  },
  attachmentLabel: {
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
  },

  // ── Bottom Thought Bar (WhatsApp Layout) ──────────
  bottomBarWrapper: {
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[3],
    paddingTop: Spacing[2],
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: '#EFECE6',
    gap: Spacing[2],
  },
  uploadingToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.surface,
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[4],
    borderRadius: Radius.full,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#ECEAE4',
    ...Shadow.xs,
  },
  uploadingToastText: {
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    borderWidth: 1.5,
    borderColor: '#ECEAE4',
    paddingLeft: Spacing[2],
    paddingRight: Spacing[3],
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    minHeight: 44,
    ...Shadow.xs,
  },
  attachBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.text,
    maxHeight: 100,
    minHeight: 38,
    paddingHorizontal: Spacing[2],
    paddingVertical: 4,
  },

  // ── Right Circle Action: Mic or Send ───────────────
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  actionMic: {
    backgroundColor: '#353330',
  },
  actionSend: {
    backgroundColor: Colors.primary,
  },
});
