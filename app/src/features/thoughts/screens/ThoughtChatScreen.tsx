import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  useWindowDimensions,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Image,
  Keyboard,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { AppText, DatePickerModal } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize, Shadow } from '@/theme';
import { getSafeBottomPadding } from '@/utils/safe-area';
import { useThemeColors } from '@/hooks/use-mood-theme';
import { useThoughts, useDayStream, useTags, type StreamThought } from '@/hooks/use-thoughts';
import {
  usePeople,
  useMentionPeopleSearch,
  upsertKnownPeopleInStore,
  type SavePersonInput,
} from '@/hooks/use-people';
import type { Thought, ThoughtMood } from '@/services/thoughts.service';
import type { Person } from '@/services/people.service';
import { uploadToR2 } from '@/services/upload.service';
import { playTypewriterSound } from '@/services/typewriter-sound.service';
import { MentionSuggestionsBox } from '@/features/people/components/MentionSuggestionsBox';
import { MentionText } from '@/features/people/components/MentionText';
import { AddEditPersonModal } from '@/features/people/components/AddEditPersonModal';
import { TagSuggestionsBox } from '../components/TagSuggestionsBox';
import {
  getActiveMentionTrigger,
  insertMentionAtTrigger,
  parseMentionSegments,
} from '@/features/people/utils/mentions';
import { getActiveTagTrigger, insertTagAtTrigger } from '../utils/tags';
import {
  EMOTION_LIST,
  EMOTION_MAP,
  serializeEmotionThought,
  parseEmotionThought,
  type EmotionDef,
} from '../utils/emotions';
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
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { id, prompt, mood: initialMoodParam } = useLocalSearchParams<{
    id: string;
    prompt?: string;
    mood?: string;
  }>();
  const dayDate = typeof id === 'string' ? id : new Date().toISOString().split('T')[0];

  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET;
  const isSmallPhone = width < 370;
  const maxW = isTablet ? 580 : undefined;

  const {
    thoughts,
    loading,
    addThought,
    editThought,
    toggleStarThought,
    removeThought,
    removeThoughts,
    fetchThoughts,
  } = useDayStream(dayDate);
  const { days } = useThoughts();
  const { people, addPerson } = usePeople({ autoFetch: false });
  const { tags, fetchTags } = useTags();
  const [text, setText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMood, setSelectedMood] = useState<ThoughtMood | null>(null);
  const [showMoodBar, setShowMoodBar] = useState(false);
  const [emojiBursts, setEmojiBursts] = useState<{ id: number; emoji: string }[]>([]);
  const [replyingTo, setReplyingTo] = useState<StreamThought | null>(null);
  const [editingThought, setEditingThought] = useState<StreamThought | null>(null);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [dismissedAtIndex, setDismissedAtIndex] = useState<number | null>(null);
  const [dismissedHashIndex, setDismissedHashIndex] = useState<number | null>(null);
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);
  const [showQuickAddPerson, setShowQuickAddPerson] = useState(false);
  const [quickAddInitialName, setQuickAddInitialName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showCustomCamera, setShowCustomCamera] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [optimisticThoughts, setOptimisticThoughts] = useState<StreamThought[]>([]);
  const [uploadJobs, setUploadJobs] = useState<Record<string, UploadJob>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollViewRef = useRef<any>(null);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTags(true);
    }, [fetchTags])
  );

  useEffect(() => {
    if (typeof prompt === 'string' && prompt.trim()) {
      setText(prompt);
      setCursorIndex(prompt.length);
    }
    if (typeof initialMoodParam === 'string' && EMOTION_MAP[initialMoodParam]) {
      setShowMoodBar(true);
    }
  }, [prompt, initialMoodParam]);

  // Send / Mic button bounce animation
  const actionScale = useRef(new Animated.Value(1)).current;

  const isSelectionMode = selectedIds.length > 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchThoughts();
    setRefreshing(false);
  };

  // Combine confirmed/store thoughts + pending media uploads without duplicate keys
  const displayThoughts: StreamThought[] = [
    ...thoughts,
    ...optimisticThoughts.filter(
      (opt) => !thoughts.some((t) => t.id === opt.id || t.clientKey === opt.id)
    ),
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
  const startMediaUpload = async (
    tempId: string,
    media: PendingMedia,
    caption?: string,
    mentionedPersonIds?: string[]
  ) => {
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

      const saved = await addThought(finalPayload, media.type, mentionedPersonIds, tempId);
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

      const saved = await addThought(finalPayload, 'audio', undefined, tempId);
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
  const handleMediaPreviewSend = (
    media: PendingMedia,
    caption: string,
    mentionedPersonIds?: string[]
  ) => {
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

    startMediaUpload(tempId, media, caption, mentionedPersonIds);
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

  const mentionTrigger = getActiveMentionTrigger(text, cursorIndex);
  const mentionQuery = mentionTrigger?.query.trim() ?? '';
  const isMentionTriggerActive = Boolean(
    mentionTrigger &&
      mentionTrigger.startIndex !== dismissedAtIndex &&
      mentionQuery.length > 0
  );
  const { results: filteredMentionPeople, searching: searchingMentions } =
    useMentionPeopleSearch(mentionTrigger?.query ?? '', isMentionTriggerActive);
  const showMentionPopup = Boolean(
    isMentionTriggerActive &&
      mentionTrigger &&
      (searchingMentions || filteredMentionPeople.length > 0 || !mentionTrigger.query.includes(' '))
  );

  const tagTrigger = getActiveTagTrigger(text, cursorIndex);
  const showTagPopup = Boolean(
    !showMentionPopup &&
      tagTrigger &&
      tagTrigger.startIndex !== dismissedHashIndex
  );

  const handleSelectTag = (tag: string) => {
    if (!tagTrigger) return;
    const { nextText, nextCursorIndex } = insertTagAtTrigger(text, tagTrigger, tag);
    setText(nextText);
    setCursorIndex(nextCursorIndex);
    setDismissedHashIndex(tagTrigger.startIndex);
  };

  const handleSelectMentionPerson = (person: Person) => {
    if (!mentionTrigger) return;
    setShowAttachmentMenu(false);
    upsertKnownPeopleInStore([person]);
    const { nextText, nextCursorIndex } = insertMentionAtTrigger(text, mentionTrigger, person);
    setText(nextText);
    setCursorIndex(nextCursorIndex);
    setDismissedAtIndex(mentionTrigger.startIndex);
    setSelectedMentionIds((prev) => (prev.includes(person.id) ? prev : [...prev, person.id]));
  };

  const handleOpenQuickAddPerson = (suggestedName: string) => {
    setQuickAddInitialName(suggestedName);
    setShowQuickAddPerson(true);
  };

  const handleQuickAddSave = async (payload: SavePersonInput) => {
    const createdPerson = await addPerson(payload);
    if (mentionTrigger) {
      const { nextText, nextCursorIndex } = insertMentionAtTrigger(
        text,
        mentionTrigger,
        createdPerson
      );
      setText(nextText);
      setCursorIndex(nextCursorIndex);
      setDismissedAtIndex(mentionTrigger.startIndex);
      setSelectedMentionIds((prev) =>
        prev.includes(createdPerson.id) ? prev : [...prev, createdPerson.id]
      );
    }
  };

  // ── Direct Emotion Reaction Send: bouncy animation + immediate chat save ─
  const handleSendEmotion = (emotion: EmotionDef) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    playTypewriterSound('bell');

    const burstId = Date.now() + Math.random();
    setEmojiBursts((prev) => [...prev.slice(-4), { id: burstId, emoji: emotion.emoji }]);
    setTimeout(() => {
      setEmojiBursts((prev) => prev.filter((b) => b.id !== burstId));
    }, 1550);

    const replyTarget = replyingTo;
    setReplyingTo(null);

    addThought(serializeEmotionThought(emotion), 'emotion', [], undefined, {
      mood: emotion.key,
      replyTo: replyTarget,
    });
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 60);
  };

  // ── Text send (or edit confirm): instant 0ms update ────────────────────
  const handleSend = () => {
    if (!text.trim()) return;

    playTypewriterSound('bell');

    Animated.sequence([
      Animated.timing(actionScale, { toValue: 0.82, duration: 80, useNativeDriver: true }),
      Animated.spring(actionScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    const content = text.trim();
    const mentionIdsToSend = [...selectedMentionIds];
    setText('');
    setCursorIndex(0);
    setDismissedAtIndex(null);
    setDismissedHashIndex(null);
    setSelectedMentionIds([]);

    if (editingThought) {
      const target = editingThought;
      setEditingThought(null);
      editThought(target.id, {
        content,
        mood: selectedMood,
        mentionedPersonIds: mentionIdsToSend,
      });
      return;
    }

    const replyTarget = replyingTo;
    const moodToSend = selectedMood;
    setReplyingTo(null);

    addThought(content, 'thinking', mentionIdsToSend, undefined, {
      mood: moodToSend,
      replyTo: replyTarget,
    });
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 60);
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

  const singleSelectedThought =
    selectedIds.length === 1
      ? displayThoughts.find((t) => t.id === selectedIds[0]) ?? null
      : null;

  const isSingleTextThought = Boolean(
    singleSelectedThought &&
      !parseAttachmentThought(singleSelectedThought.content) &&
      !parseEmotionThought(singleSelectedThought.content)
  );

  const handleStarSelected = () => {
    if (!singleSelectedThought) return;
    toggleStarThought(singleSelectedThought.id);
    setSelectedIds([]);
  };

  const handleReplySelected = () => {
    if (!singleSelectedThought) return;
    setEditingThought(null);
    setReplyingTo(singleSelectedThought);
    setSelectedIds([]);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const handleEditSelected = () => {
    if (!singleSelectedThought || !isSingleTextThought) return;
    setReplyingTo(null);
    setEditingThought(singleSelectedThought);
    setText(singleSelectedThought.content);
    setSelectedMood(singleSelectedThought.mood ?? null);
    setCursorIndex(singleSelectedThought.content.length);
    setDismissedAtIndex(null);
    setDismissedHashIndex(null);
    const existingIds = [
      ...new Set(
        parseMentionSegments(singleSelectedThought.content, people)
          .map((s) => s.person?.id)
          .filter((pid): pid is string => Boolean(pid))
      ),
    ];
    setSelectedMentionIds(existingIds);
    setSelectedIds([]);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const hasText = text.trim().length > 0;
  const chatBottomPadding = keyboardVisible
    ? Spacing[2]
    : getSafeBottomPadding(insets.bottom, 18, 48, 32);

  const streamBottomSpacer =
    chatBottomPadding +
    76 +
    (showMoodBar ? 46 : 0) +
    (replyingTo || editingThought ? 58 : 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* ── 4. Clean Top Bar: Back, Calendar & Selection Actions (Star, Reply, Edit, Delete) ── */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.background },
          isSmallPhone && { paddingHorizontal: Spacing[3] },
          isSelectionMode && [
            styles.topBarSelection,
            { backgroundColor: colors.primarySoft, borderBottomColor: colors.primaryBorder },
          ],
          maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
        ]}
      >
        {/* Left: Back button or Close selection */}
        {isSelectionMode ? (
          <TouchableOpacity
            onPress={handleClearSelection}
            style={[styles.headerGhostBtn, isSmallPhone && styles.headerCompactBtn]}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={isSmallPhone ? 21 : 24} color={Colors.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.headerBtn, isSmallPhone && styles.headerCompactBtn]}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={isSmallPhone ? 20 : 22} color={Colors.text} />
          </TouchableOpacity>
        )}

        {/* Center: Clean Spacer / Selection count */}
        <View style={styles.topCenter}>
          {isSelectionMode && (
            <AppText
              variant="title"
              numberOfLines={1}
              style={[styles.selectionTitle, isSmallPhone && styles.selectionTitleSmall]}
            >
              {selectedIds.length} selected
            </AppText>
          )}
        </View>

        {/* Right Actions: Calendar OR Selection Action Icons */}
        <View style={[styles.headerRightRow, isSmallPhone && { gap: 2 }]}>
          {isSelectionMode ? (
            <>
              {singleSelectedThought && (
                <>
                  <TouchableOpacity
                    onPress={handleStarSelected}
                    style={[styles.headerGhostBtn, isSmallPhone && styles.headerCompactBtn]}
                    hitSlop={6}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={singleSelectedThought.is_starred ? 'star' : 'star-outline'}
                      size={isSmallPhone ? 18 : 20}
                      color={singleSelectedThought.is_starred ? colors.primary : Colors.text}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleReplySelected}
                    style={[styles.headerGhostBtn, isSmallPhone && styles.headerCompactBtn]}
                    hitSlop={6}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="arrow-undo-outline"
                      size={isSmallPhone ? 18 : 20}
                      color={Colors.text}
                    />
                  </TouchableOpacity>

                  {isSingleTextThought && (
                    <TouchableOpacity
                      onPress={handleEditSelected}
                      style={[styles.headerGhostBtn, isSmallPhone && styles.headerCompactBtn]}
                      hitSlop={6}
                      activeOpacity={0.7}
                    >
                      <Feather name="edit-2" size={isSmallPhone ? 16 : 18} color={Colors.text} />
                    </TouchableOpacity>
                  )}
                </>
              )}

              <TouchableOpacity
                onPress={handleDeletePress}
                style={[styles.headerDeleteBtn, isSmallPhone && styles.headerCompactBtn]}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Feather name="trash-2" size={isSmallPhone ? 18 : 21} color="#D93838" />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.headerBtn, isSmallPhone && styles.headerCompactBtn]}
              hitSlop={8}
              activeOpacity={0.7}
              onPress={() => setShowDatePicker(true)}
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
              { paddingBottom: streamBottomSpacer },
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
                tintColor={colors.primary}
                colors={[colors.primary]}
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
                  key={t.clientKey || t.id || idx}
                  thought={t}
                  people={people}
                  isSelected={selectedIds.includes(t.id)}
                  isSelectionMode={isSelectionMode}
                  isDeleting={deletingIds.includes(t.id)}
                  uploadJob={uploadJobs[t.id]}
                  onRetry={() => handleRetryUpload(t.id)}
                  onLongPress={() => handleLongPressThought(t.id)}
                  onToggleSelect={() => handleToggleSelectThought(t.id)}
                  onPressMention={(person) => router.push(`/people/${person.id}` as any)}
                />
              ))
            )}
          </ScrollView>
        )}

        {/* ── Floating Bottom Stack (WhatsApp Style — Transparent BG) ── */}
        <View pointerEvents="box-none" style={styles.floatingComposerOverlay}>
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
                <View style={[styles.attachmentCircle, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="mic" size={24} color={colors.primary} />
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

        {/* ── @Mention Autocomplete Tray (Floating directly above input bar) ── */}
        {showMentionPopup && mentionTrigger && (
          <View
            style={maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : undefined}
          >
            <MentionSuggestionsBox
              people={filteredMentionPeople}
              query={mentionTrigger.query}
              searching={searchingMentions}
              onSelectPerson={handleSelectMentionPerson}
              onQuickAddPerson={handleOpenQuickAddPerson}
            />
          </View>
        )}

        {/* ── #Tag Autocomplete Tray ── */}
        {showTagPopup && tagTrigger && (
          <View
            style={maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : undefined}
          >
            <TagSuggestionsBox
              tags={tags}
              query={tagTrigger.query}
              onSelectTag={handleSelectTag}
            />
          </View>
        )}

        {/* ── Floating Emoji Burst Overlay on Emotion Send ── */}
        {emojiBursts.length > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.burstOverlay,
              { bottom: chatBottomPadding + (showMoodBar ? 108 : 62) },
            ]}
          >
            {emojiBursts.map((b) => (
              <FloatingEmojiBurst key={b.id} emoji={b.emoji} />
            ))}
          </View>
        )}

        {/* ── Bottom Thought Bar (WhatsApp Layout) ─── */}
        <View
          style={[
            styles.bottomBarWrapper,
            isSmallPhone && { paddingHorizontal: Spacing[3] },
            { paddingBottom: chatBottomPadding },
            maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
          ]}
        >
          {/* Expressive Emoji Emotion Bar (tap any emoji to send directly!) */}
          {showMoodBar && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={styles.moodPickerContent}
              style={styles.moodPickerStrip}
            >
              {EMOTION_LIST.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => handleSendEmotion(m)}
                  activeOpacity={0.82}
                  style={[
                    styles.moodOptionChip,
                    { backgroundColor: m.color, borderColor: m.color },
                  ]}
                >
                  <AppText style={styles.moodEmojiIcon}>{m.emoji}</AppText>
                  <AppText variant="caption" style={styles.moodOptionText}>
                    {m.label}
                  </AppText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Reply or Edit Context Banner */}
          {(replyingTo || editingThought) && (
            <View style={styles.contextBanner}>
              <View style={[styles.contextAccent, { backgroundColor: colors.primary }]} />
              <View style={styles.contextTextCol}>
                <AppText variant="caption" style={[styles.contextTitle, { color: colors.primaryDark }]}>
                  {editingThought ? 'Editing thought' : 'Replying to thought'}
                </AppText>
                <AppText variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                  {formatAttachmentPreview((editingThought || replyingTo)!.content)}
                </AppText>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (editingThought) {
                    setText('');
                    setSelectedMood(null);
                  }
                  setEditingThought(null);
                  setReplyingTo(null);
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.chatRow}>
            {/* Left Pill: Attachment Paperclip + Mood + Text Input */}
            <View style={[styles.inputPill, isSmallPhone && { paddingLeft: 5, paddingRight: 6 }]}>
              <TouchableOpacity
                onPress={() => setShowAttachmentMenu(!showAttachmentMenu)}
                style={[styles.attachBtn, isSmallPhone && styles.compactComposerBtn]}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showAttachmentMenu ? 'close-circle' : 'attach-outline'}
                  size={isSmallPhone ? 21 : 23}
                  color={showAttachmentMenu ? colors.primary : Colors.textSecondary}
                />
              </TouchableOpacity>

              {/* Emoji Emotions Bar Toggle */}
              <TouchableOpacity
                onPress={() => setShowMoodBar((v) => !v)}
                style={[
                  styles.typewriterToggleBtn,
                  isSmallPhone && styles.compactComposerBtn,
                  showMoodBar && [
                    styles.typewriterToggleBtnActive,
                    { backgroundColor: colors.primaryLight },
                  ],
                ]}
                hitSlop={6}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={showMoodBar ? 'happy' : 'happy-outline'}
                  size={isSmallPhone ? 18 : 20}
                  color={showMoodBar ? colors.primary : Colors.textSecondary}
                />
              </TouchableOpacity>

              {/* Text Input */}
              <TextInput
                ref={inputRef}
                placeholder={isSmallPhone ? 'Type a thought...' : 'Type a thought, @mention, or #tag...'}
                placeholderTextColor={Colors.textMuted}
                value={text}
                onChangeText={(val) => {
                  // Authentic mechanical typewriter sounds on system keyboard too!
                  if (val.length < text.length) {
                    playTypewriterSound('backspace');
                  } else if (val.endsWith(' ') && val.length > text.length) {
                    playTypewriterSound('space');
                  } else if (val.length > text.length) {
                    playTypewriterSound('key');
                  }
                  const delta = val.length - text.length;
                  const estCursor = Math.max(0, Math.min(val.length, cursorIndex + delta));
                  setText(val);
                  setCursorIndex(estCursor);
                  if (dismissedAtIndex !== null) {
                    const activeAfter = getActiveMentionTrigger(val, estCursor);
                    if (
                      estCursor <= dismissedAtIndex ||
                      val.length <= dismissedAtIndex ||
                      val[dismissedAtIndex] !== '@' ||
                      (val.length < text.length &&
                        activeAfter?.startIndex === dismissedAtIndex &&
                        !activeAfter.query.includes(' '))
                    ) {
                      setDismissedAtIndex(null);
                    }
                  }
                  if (dismissedHashIndex !== null && val.length <= dismissedHashIndex) {
                    setDismissedHashIndex(null);
                  }
                }}
                onSelectionChange={(e) => {
                  const pos = e.nativeEvent.selection.end;
                  setCursorIndex(pos);
                  if (dismissedAtIndex !== null && pos <= dismissedAtIndex) {
                    setDismissedAtIndex(null);
                  }
                  if (dismissedHashIndex !== null && pos <= dismissedHashIndex) {
                    setDismissedHashIndex(null);
                  }
                }}
                multiline
                maxLength={1200}
                style={[
                  styles.textInput,
                  isSmallPhone && { fontSize: FontSize.sm, paddingHorizontal: Spacing[1] },
                ]}
              />
            </View>

            {/* Right Side: Voice Mic (when empty) OR Send Button (when typing) */}
            <Animated.View style={{ transform: [{ scale: actionScale }] }}>
              {hasText ? (
                // Send Button: Instant chat sending (no submit blocking!)
                <TouchableOpacity
                  onPress={handleSend}
                  activeOpacity={0.85}
                  style={[
                    styles.actionCircle,
                    isSmallPhone && styles.actionCircleSmall,
                    styles.actionSend,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Ionicons name="arrow-up" size={isSmallPhone ? 18 : 20} color={Colors.white} />
                </TouchableOpacity>
              ) : (
                // Voice Mic Button — opens audio recorder
                <TouchableOpacity
                  onPress={handleVoicePress}
                  activeOpacity={0.85}
                  style={[
                    styles.actionCircle,
                    isSmallPhone && styles.actionCircleSmall,
                    styles.actionMic,
                  ]}
                >
                  <Ionicons name="mic" size={isSmallPhone ? 18 : 20} color={Colors.white} />
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>
        </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── WhatsApp-Style Media Preview Modal (Preview + Caption before sending) ── */}
      <MediaPreviewModal
        visible={Boolean(pendingMedia)}
        media={pendingMedia}
        people={people}
        onClose={() => setPendingMedia(null)}
        onSend={handleMediaPreviewSend}
      />

      {/* ── Quick Add Person Modal from Chat @Mention ── */}
      <AddEditPersonModal
        visible={showQuickAddPerson}
        initialName={quickAddInitialName}
        onClose={() => setShowQuickAddPerson(false)}
        onSave={handleQuickAddSave}
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

      {/* ── Theme Date Picker to Jump Between Day Chats ── */}
      <DatePickerModal
        visible={showDatePicker}
        selectedDate={dayDate}
        activeDates={new Set(days.map((d) => d.day_date))}
        title="Jump to Date"
        subtitle="Open thoughts recorded on any day"
        allowClear={false}
        onSelectDate={(pickedDate) => {
          if (pickedDate !== dayDate) {
            router.replace(`/thoughts/${pickedDate}` as any);
          }
        }}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}

// ── Floating Emoji Burst Particles on Direct Emotion Send ────────────────────
function FloatingEmojiBurst({ emoji }: { emoji: string }) {
  const p1 = useRef(new Animated.Value(0)).current;
  const p2 = useRef(new Animated.Value(0)).current;
  const p3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const smoothEase = Easing.out(Easing.cubic);
    Animated.stagger(110, [
      Animated.timing(p1, {
        toValue: 1,
        duration: 1350,
        easing: smoothEase,
        useNativeDriver: true,
      }),
      Animated.timing(p2, {
        toValue: 1,
        duration: 1450,
        easing: smoothEase,
        useNativeDriver: true,
      }),
      Animated.timing(p3, {
        toValue: 1,
        duration: 1350,
        easing: smoothEase,
        useNativeDriver: true,
      }),
    ]).start();
  }, [p1, p2, p3]);

  const specs = [
    { anim: p1, dx: -30, dy: -115, scalePeak: 1.15 },
    { anim: p2, dx: 0, dy: -155, scalePeak: 1.4 },
    { anim: p3, dx: 30, dy: -108, scalePeak: 1.15 },
  ];

  return (
    <View style={styles.burstCluster} pointerEvents="none">
      {specs.map((spec, idx) => (
        <Animated.Text
          key={idx}
          style={[
            styles.burstEmoji,
            {
              opacity: spec.anim.interpolate({
                inputRange: [0, 0.2, 0.72, 1],
                outputRange: [0, 1, 0.85, 0],
              }),
              transform: [
                {
                  translateX: spec.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, spec.dx],
                  }),
                },
                {
                  translateY: spec.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, spec.dy],
                  }),
                },
                {
                  scale: spec.anim.interpolate({
                    inputRange: [0, 0.35, 0.75, 1],
                    outputRange: [0.5, spec.scalePeak, 1.05, 0.8],
                  }),
                },
              ],
            },
          ]}
        >
          {emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

// ── 5. Animated Thought Bubble Card (Appearing & Thanos Snap Wipe Animation) ──
function AnimatedThoughtCard({
  thought,
  people,
  isSelected,
  isSelectionMode,
  isDeleting,
  uploadJob,
  onRetry,
  onLongPress,
  onToggleSelect,
  onPressMention,
}: {
  thought: StreamThought;
  people: Person[];
  isSelected: boolean;
  isSelectionMode: boolean;
  isDeleting: boolean;
  uploadJob?: UploadJob;
  onRetry?: () => void;
  onLongPress: () => void;
  onToggleSelect: () => void;
  onPressMention: (person: Person) => void;
}) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const attachmentPayload = parseAttachmentThought(thought.content);
  const emotionPayload = parseEmotionThought(thought.content);
  const emotionDef = emotionPayload ? EMOTION_MAP[emotionPayload.mood] : undefined;
  const isAttachment = Boolean(attachmentPayload);
  const isEmotion = Boolean(emotionPayload);
  const isLong = !isAttachment && !isEmotion && thought.content.length > 150;

  // Animation values
  const animOpacity = useRef(new Animated.Value(0)).current;
  const animTranslateY = useRef(new Animated.Value(28)).current;
  const animTranslateX = useRef(new Animated.Value(0)).current;
  const animScale = useRef(new Animated.Value(0.72)).current;
  const emojiBounce = useRef(new Animated.Value(0)).current;

  // 5. Smooth Appearing Animation on chat send/mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(animOpacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(animScale, {
        toValue: 1,
        friction: 8,
        tension: 48,
        useNativeDriver: true,
      }),
      Animated.spring(animTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();

    if (isEmotion) {
      Animated.sequence([
        Animated.delay(140),
        Animated.spring(emojiBounce, {
          toValue: 1,
          friction: 6,
          tension: 42,
          useNativeDriver: true,
        }),
      ]).start();
    }
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
          isEmotion && [
            styles.thoughtCardEmotion,
            {
              backgroundColor: emotionDef?.color || colors.primary,
            },
          ],
          isAttachment && styles.thoughtCardAttachment,
          isSelected &&
            (isAttachment
              ? styles.thoughtCardAttachmentSelected
              : isEmotion
              ? styles.thoughtCardEmotionSelected
              : [
                  styles.thoughtCardSelected,
                  { backgroundColor: colors.primary, shadowColor: colors.primary },
                ]),
        ]}
      >
        {/* Large Checkmark Indicator Badge */}
        {isSelected && (
          <View style={styles.selectedBadge}>
            <View style={styles.selectedBadgeInner}>
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            </View>
          </View>
        )}

        {isEmotion && emotionPayload ? (
          /* ── Full-Width Solid Colored Animated Emoji Card ── */
          <>
            {Boolean(thought.reply_to_preview) && (
              <View style={[styles.quoteBox, styles.quoteBoxEmotion]}>
                <View style={[styles.quoteBar, { backgroundColor: Colors.white }]} />
                <AppText
                  variant="caption"
                  numberOfLines={2}
                  color="rgba(255,255,255,0.92)"
                  style={{ flex: 1 }}
                >
                  {formatAttachmentPreview(thought.reply_to_preview || '')}
                </AppText>
              </View>
            )}

            <View style={styles.emotionBubbleRow}>
              <Animated.Text
                style={[
                  styles.emotionBubbleEmoji,
                  {
                    transform: [
                      {
                        scale: emojiBounce.interpolate({
                          inputRange: [0, 0.55, 1],
                          outputRange: [0.68, 1.18, 1],
                        }),
                      },
                      {
                        rotate: emojiBounce.interpolate({
                          inputRange: [0, 0.35, 0.7, 1],
                          outputRange: ['-7deg', '7deg', '-3deg', '0deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {emotionPayload.emoji}
              </Animated.Text>

              <View style={styles.emotionBubbleMeta}>
                <AppText variant="bodyMd" style={styles.emotionBubbleTitle}>
                  Feeling {emotionPayload.label}
                </AppText>
              </View>
            </View>

            <View style={styles.thoughtFooter}>
              {thought.is_starred && (
                <Ionicons
                  name="star"
                  size={12}
                  color={Colors.white}
                  style={{ marginRight: 5 }}
                />
              )}

              <AppText
                variant="caption"
                color="rgba(255, 255, 255, 0.9)"
                style={[styles.timeText, styles.timeTextSelected]}
              >
                {formatTime(thought.created_at)}
              </AppText>

              {thought.pendingOffline ? (
                <Ionicons
                  name="cloud-offline-outline"
                  size={12}
                  color="rgba(255, 255, 255, 0.88)"
                  style={{ marginLeft: 4 }}
                />
              ) : thought.id?.startsWith('temp_') ? (
                <Ionicons
                  name="time-outline"
                  size={12}
                  color="rgba(255, 255, 255, 0.82)"
                  style={{ marginLeft: 3 }}
                />
              ) : null}
            </View>
          </>
        ) : isAttachment && attachmentPayload ? (
          /* ── Attachment: Image / Video / Audio (with frosted glass progress & retry) ── */
          <>
            <AttachmentCard
              payload={attachmentPayload}
              isSelected={isSelected}
              uploadStatus={uploadJob?.status}
              uploadProgress={uploadJob?.progress}
              uploadProgressText={uploadJob?.progressText}
              onRetry={onRetry}
              people={people}
              onPressMention={isSelectionMode ? undefined : onPressMention}
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
            {/* Quote-Reply Box if replying to an earlier thought */}
            {Boolean(thought.reply_to_preview) && (
              <View style={[styles.quoteBox, isSelected && styles.quoteBoxSelected]}>
                <View
                  style={[
                    styles.quoteBar,
                    { backgroundColor: colors.primary },
                    isSelected && { backgroundColor: Colors.white },
                  ]}
                />
                <AppText
                  variant="caption"
                  numberOfLines={2}
                  color={isSelected ? 'rgba(255,255,255,0.9)' : Colors.textSecondary}
                  style={{ flex: 1 }}
                >
                  {formatAttachmentPreview(thought.reply_to_preview || '')}
                </AppText>
              </View>
            )}

            {/* Content Body (Pure white when solid filled selected) */}
            <MentionText
              text={thought.content}
              people={people}
              variant="body"
              color={isSelected ? Colors.white : Colors.text}
              numberOfLines={expanded ? undefined : 6}
              style={[styles.thoughtBodyText, isSelected && styles.thoughtBodyTextSelected]}
              mentionStyle={isSelected ? styles.mentionTextSelected : undefined}
              tagStyle={isSelected ? styles.mentionTextSelected : undefined}
              onPressMention={isSelectionMode ? undefined : onPressMention}
              onPressTag={
                isSelectionMode
                  ? undefined
                  : (tag) => router.push({ pathname: '/(tabs)/thoughts' as any, params: { tag } })
              }
            />

            {/* Read More / Read Less Toggle */}
            {isLong && (
              <TouchableOpacity
                onPress={() => setExpanded(!expanded)}
                activeOpacity={0.7}
                style={styles.readMoreRow}
              >
                <AppText
                  variant="caption"
                  color={isSelected ? Colors.white : colors.primaryDark}
                  style={{ fontFamily: FontFamily.bold }}
                >
                  {expanded ? 'Show less' : 'Read more'}
                </AppText>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color={isSelected ? Colors.white : colors.primaryDark}
                />
              </TouchableOpacity>
            )}

            {/* Footer row: Mood, Star, Offline indicator, Time */}
            <View style={styles.thoughtFooter}>
              {thought.mood && EMOTION_MAP[thought.mood] && (
                <View
                  style={[
                    styles.moodMiniBadge,
                    { backgroundColor: EMOTION_MAP[thought.mood].color },
                    isSelected && { backgroundColor: 'rgba(0,0,0,0.22)' },
                  ]}
                >
                  <AppText style={{ fontSize: 11 }}>{EMOTION_MAP[thought.mood].emoji}</AppText>
                  <AppText variant="caption" style={styles.moodMiniText}>
                    {EMOTION_MAP[thought.mood].label}
                  </AppText>
                </View>
              )}

              {thought.is_starred && (
                <Ionicons
                  name="star"
                  size={12}
                  color={isSelected ? Colors.white : colors.primary}
                  style={{ marginRight: 5 }}
                />
              )}

              <AppText
                variant="caption"
                color={isSelected ? 'rgba(255, 255, 255, 0.9)' : Colors.textMuted}
                style={[styles.timeText, isSelected && styles.timeTextSelected]}
              >
                {formatTime(thought.created_at)}
              </AppText>

              {thought.pendingOffline ? (
                <Ionicons
                  name="cloud-offline-outline"
                  size={12}
                  color={isSelected ? 'rgba(255, 255, 255, 0.85)' : Colors.warning}
                  style={{ marginLeft: 4 }}
                />
              ) : thought.id?.startsWith('temp_') ? (
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={isSelected ? 'rgba(255, 255, 255, 0.8)' : Colors.textMuted}
                  style={{ marginLeft: 3 }}
                />
              ) : null}
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
    backgroundColor: Colors.primarySoft,
    borderBottomColor: Colors.primaryBorder,
  },
  topCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: Spacing[2],
  },
  selectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  selectionTitleSmall: {
    fontSize: FontSize.md,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
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
  headerCompactBtn: {
    width: 32,
    height: 32,
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
    fontFamily: FontFamily.handwriting,
  },
  mentionTextSelected: {
    color: '#FFFFFF',
    textDecorationLine: 'underline',
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
    fontFamily: FontFamily.handwriting,
    fontSize: 20,
    lineHeight: 27,
    color: '#26201B',
    letterSpacing: 0.25,
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

  // ── Floating Bottom Thought Bar (WhatsApp Layout) ─
  floatingComposerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    backgroundColor: 'transparent',
  },
  bottomBarWrapper: {
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[3],
    paddingTop: Spacing[1],
    backgroundColor: 'transparent',
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
    alignItems: 'flex-end', // WhatsApp style: Send/Mic button anchored at bottom
    gap: Spacing[2],
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end', // Anchors icons cleanly at the bottom line like WhatsApp
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    borderWidth: 1.5,
    borderColor: '#ECEAE4',
    paddingLeft: Spacing[2],
    paddingRight: Spacing[2],
    paddingVertical: Platform.OS === 'ios' ? 4 : 3,
    minHeight: 44,
    ...Shadow.sm,
  },
  attachBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 2 : 1,
  },
  typewriterToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
    marginBottom: Platform.OS === 'ios' ? 2 : 1,
  },
  typewriterToggleBtnActive: {
    backgroundColor: Colors.primaryLight, // Theme soft amber chip
  },
  compactComposerBtn: {
    width: 28,
    height: 28,
    marginRight: 0,
  },
  textInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.text,
    maxHeight: 110,
    minHeight: 34,
    paddingHorizontal: Spacing[2],
    paddingTop: Platform.OS === 'ios' ? 6 : 4,
    paddingBottom: Platform.OS === 'ios' ? 6 : 4,
    textAlignVertical: 'center', // Strict single-line stability, WhatsApp feel
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
  actionCircleSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  actionMic: {
    backgroundColor: '#353330',
  },
  actionSend: {
    backgroundColor: Colors.primary,
  },
  moodPickerStrip: {
    flexGrow: 0,
  },
  moodPickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingVertical: 2,
    paddingRight: Spacing[2],
  },
  moodOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 0,
    ...Shadow.xs,
  },
  moodEmojiIcon: {
    fontSize: 16,
    lineHeight: 20,
  },
  moodOptionText: {
    fontSize: 12,
    fontFamily: FontFamily.bold,
    color: Colors.white,
  },
  burstOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 25,
  },
  burstCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstEmoji: {
    fontSize: 30,
    lineHeight: 34,
  },
  thoughtCardEmotion: {
    width: '100%',
    borderWidth: 0,
    borderRadius: Radius['2xl'],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
  },
  thoughtCardEmotionSelected: {
    borderWidth: 2.5,
    borderColor: '#241B14',
  },
  quoteBoxEmotion: {
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
  emotionBubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  emotionBubbleEmoji: {
    fontSize: 38,
    lineHeight: 46,
  },
  emotionBubbleMeta: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  emotionBubbleTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.white,
  },
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderWidth: 1,
    borderColor: '#ECEAE4',
  },
  contextAccent: {
    width: 3,
    height: 26,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  contextTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  contextTitle: {
    fontFamily: FontFamily.bold,
    color: Colors.primaryDark,
    fontSize: 11,
  },
  quoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: '#F7F4EE',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: 6,
  },
  quoteBoxSelected: {
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  quoteBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  moodMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    marginRight: 'auto' as any,
  },
  moodMiniText: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    color: Colors.white,
    textTransform: 'capitalize',
  },
});
