import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  RefreshControl,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize, Shadow } from '@/theme';
import { usePeople, usePersonDetails, type SavePersonInput } from '@/hooks/use-people';
import { useThemeColors } from '@/hooks/use-mood-theme';
import { useDayStream } from '@/hooks/use-thoughts';
import type { Person, PersonMentionThought } from '@/services/people.service';
import {
  AttachmentCard,
  parseAttachmentThought,
} from '@/features/thoughts/components/AttachmentCard';
import { MentionText } from '../components/MentionText';
import { AddEditPersonModal } from '../components/AddEditPersonModal';
import { getSafeBottomPadding } from '@/utils/safe-area';

const TABLET = 600;

function formatDateLabel(dayDate: string, isoStr?: string): string {
  const sourceDate = dayDate || (isoStr ? isoStr.split('T')[0] : '');
  if (!sourceDate) return '';

  const [year, month, day] = sourceDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const todayStr = new Date().toISOString().split('T')[0];

  const formatted = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (sourceDate === todayStr) {
    return `Today • ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return formatted;
}

function formatTime(isoStr: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function PersonDetailScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const personId = typeof id === 'string' ? id : '';

  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET;
  const isSmallPhone = width < 370;
  const maxW = isTablet ? 580 : undefined;

  const todayStr = new Date().toISOString().split('T')[0];
  const { people, editPerson, removePerson } = usePeople();
  const { person, mentions, loading, error, setPerson, fetchDetails } =
    usePersonDetails(personId);
  const { addThought } = useDayStream(todayStr);

  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [coFilterPersonId, setCoFilterPersonId] = useState<string | null>(null);
  const [quickText, setQuickText] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s1 = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const s2 = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (personId) {
        fetchDetails(true);
      }
    }, [personId, fetchDetails])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDetails(false);
    setRefreshing(false);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/people' as any);
    }
  };

  const handleSaveEdit = async (payload: SavePersonInput) => {
    if (!person) return;
    const updated = await editPerson(person.id, payload);
    setPerson(updated);
  };

  const handleDeletePerson = () => {
    if (!person) return;
    Alert.alert(
      `Remove ${person.name}?`,
      'Your thought messages will remain in daily chats, and this person profile will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removePerson(person.id);
              handleBack();
            } catch (err: any) {
              Alert.alert('Could not delete', err?.message || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const coMentionedPeople = useMemo(() => {
    const counts = new Map<string, number>();
    mentions.forEach((m) => {
      m.co_mentioned_ids?.forEach((cid) => {
        counts.set(cid, (counts.get(cid) || 0) + 1);
      });
    });
    return people
      .filter((p) => p.id !== personId && counts.has(p.id))
      .map((p) => ({ person: p, count: counts.get(p.id)! }));
  }, [mentions, people, personId]);

  const displayedMentions = useMemo(() => {
    if (!coFilterPersonId) return mentions;
    return mentions.filter((m) => m.co_mentioned_ids?.includes(coFilterPersonId));
  }, [mentions, coFilterPersonId]);

  const handleQuickSend = () => {
    if (!person || !quickText.trim()) return;
    const raw = quickText.trim();
    const hasMention =
      raw.toLowerCase().includes(`@${person.name.toLowerCase()}`) ||
      raw.toLowerCase().includes(`@${person.handle.toLowerCase()}`);
    const finalContent = hasMention ? raw : `@${person.name} ${raw}`;
    setQuickText('');
    addThought(finalContent, 'thinking', [person.id]);
  };

  const composerBottom = keyboardVisible
    ? Spacing[2]
    : getSafeBottomPadding(insets.bottom, 16, 48, 32);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* ── Clean Top Bar ── */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.background },
          isSmallPhone && { paddingHorizontal: Spacing[3] },
          maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
        ]}
      >
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.headerBtn, isSmallPhone && styles.headerBtnCompact]}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={isSmallPhone ? 20 : 22} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.topCenter}>
          <AppText
            variant="title"
            numberOfLines={1}
            style={[styles.topTitle, isSmallPhone && { fontSize: FontSize.md }]}
          >
            {person?.name || 'Person'}
          </AppText>
        </View>

        <View style={[styles.headerRightRow, isSmallPhone && { gap: 4 }]}>
          {person && (
            <>
              <TouchableOpacity
                onPress={() => setShowEditModal(true)}
                style={[styles.headerBtn, isSmallPhone && styles.headerBtnCompact]}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Feather name="edit-2" size={isSmallPhone ? 15 : 17} color={Colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDeletePerson}
                style={[styles.headerBtn, isSmallPhone && styles.headerBtnCompact]}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Feather name="trash-2" size={isSmallPhone ? 15 : 17} color="#D93838" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* ── Main Content ── */}
        {loading && !person ? (
          <DetailSkeletonLoader maxW={maxW} />
        ) : error && !person ? (
          <View style={styles.errorState}>
            <Ionicons name="alert-circle-outline" size={38} color={Colors.error} />
            <AppText variant="title">{error}</AppText>
            <Button
              label="Go Back"
              variant="secondary"
              fullWidth={false}
              onPress={handleBack}
            />
          </View>
        ) : person ? (
          <>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: composerBottom + 74 },
                maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
            >
              {/* ── Person Summary Card ── */}
              <View style={styles.profileCard}>
                <View style={styles.profileTopRow}>
                  <TouchableOpacity
                    onPress={() => setShowEditModal(true)}
                    activeOpacity={0.85}
                    style={styles.profileAvatarWrap}
                  >
                    {person.avatar_url ? (
                      <Image
                        source={{ uri: person.avatar_url }}
                        style={[styles.profileAvatar, isSmallPhone && styles.profileAvatarSmall]}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.profileAvatarFallback,
                          isSmallPhone && styles.profileAvatarSmall,
                        ]}
                      >
                        <Ionicons
                          name="person"
                          size={isSmallPhone ? 28 : 32}
                          color={Colors.white}
                        />
                      </View>
                    )}
                    <View style={[styles.editPhotoBadge, { backgroundColor: colors.primary }]}>
                      <Ionicons name="camera" size={12} color={Colors.white} />
                    </View>
                  </TouchableOpacity>

                  <View style={styles.profileInfoCol}>
                    <AppText
                      numberOfLines={2}
                      style={[styles.profileName, isSmallPhone && { fontSize: 21 }]}
                    >
                      {person.name}
                    </AppText>
                    <AppText variant="label" numberOfLines={1} color={Colors.textSecondary}>
                      @{person.handle}
                    </AppText>
                    <View style={styles.profileStatsRow}>
                      <View style={[styles.mentionPill, { backgroundColor: colors.primaryLight }]}>
                        <Ionicons name="at" size={13} color={colors.primaryDark} />
                        <AppText variant="caption" style={[styles.mentionPillText, { color: colors.primaryDark }]}>
                          {mentions.length} {mentions.length === 1 ? 'mention' : 'mentions'}
                        </AppText>
                      </View>

                      {Boolean(person.relationship) && (
                        <View style={styles.relTagPill}>
                          <AppText variant="caption" style={styles.relTagText}>
                            {person.relationship}
                          </AppText>
                        </View>
                      )}

                      {Boolean(person.birthday) && (
                        <View style={styles.relTagPill}>
                          <Ionicons name="gift-outline" size={11} color={Colors.textSecondary} />
                          <AppText variant="caption" style={styles.relTagText}>
                            {person.birthday}
                          </AppText>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {Boolean(person.notes) && (
                  <View style={[styles.notesBox, { backgroundColor: colors.background }]}>
                    <AppText variant="caption" color={Colors.textSecondary} style={{ lineHeight: 18 }}>
                      {person.notes}
                    </AppText>
                  </View>
                )}
              </View>

              {/* ── Multi-Person Co-Mention Filter ── */}
              {coMentionedPeople.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.coFilterRow}
                >
                  <TouchableOpacity
                    onPress={() => setCoFilterPersonId(null)}
                    style={[styles.coChip, !coFilterPersonId && styles.coChipActive]}
                    activeOpacity={0.8}
                  >
                    <AppText
                      variant="caption"
                      style={[styles.coChipText, !coFilterPersonId && styles.coChipTextActive]}
                    >
                      All ({mentions.length})
                    </AppText>
                  </TouchableOpacity>

                  {coMentionedPeople.map(({ person: co, count }) => {
                    const active = coFilterPersonId === co.id;
                    return (
                      <TouchableOpacity
                        key={co.id}
                        onPress={() => setCoFilterPersonId(active ? null : co.id)}
                        style={[styles.coChip, active && styles.coChipActive]}
                        activeOpacity={0.8}
                      >
                        <AppText
                          variant="caption"
                          style={[styles.coChipText, active && styles.coChipTextActive]}
                        >
                          + {co.name} ({count})
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* ── Mentioned Messages Stream ── */}
              <View style={styles.sectionHeaderRow}>
                <AppText variant="label" color={Colors.textMuted} style={styles.sectionLabel}>
                  MENTIONED MESSAGES
                </AppText>
                <View style={styles.sectionLine} />
              </View>

              {displayedMentions.length === 0 ? (
                <View style={styles.emptyMentions}>
                  <View style={[styles.emptyIconCircle, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.primary} />
                  </View>
                  <AppText style={styles.emptyTitle}>Nothing mentioned yet</AppText>
                  <AppText
                    variant="body"
                    color={Colors.textSecondary}
                    align="center"
                    style={styles.emptyText}
                  >
                    Type a note below or mention @{person.name} in any daily thought chat.
                  </AppText>
                </View>
              ) : (
                displayedMentions.map((item) => (
                  <MentionMessageCard
                    key={item.id}
                    item={item}
                    people={people.length > 0 ? people : [person]}
                  />
                ))
              )}
            </ScrollView>

            {/* ── Floating Quick "Write about @Name" Composer Bar ── */}
            <View
              pointerEvents="box-none"
              style={[
                styles.quickComposerWrap,
                isSmallPhone && { paddingHorizontal: Spacing[3] },
                { paddingBottom: composerBottom },
                maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
              ]}
            >
              <View style={styles.quickComposerRow}>
                <View
                  style={[
                    styles.quickInputPill,
                    isSmallPhone && { paddingHorizontal: Spacing[2] },
                  ]}
                >
                  <Ionicons name="at" size={17} color={colors.primaryDark} />
                  <TextInput
                    value={quickText}
                    onChangeText={setQuickText}
                    placeholder={
                      isSmallPhone
                        ? `Note about ${person.name}...`
                        : `Write a thought about ${person.name}...`
                    }
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    maxLength={800}
                    style={styles.quickInput}
                  />
                </View>
                <TouchableOpacity
                  onPress={handleQuickSend}
                  disabled={!quickText.trim()}
                  activeOpacity={0.85}
                  style={[
                    styles.quickSendBtn,
                    { backgroundColor: colors.primary },
                    isSmallPhone && { width: 40, height: 40, borderRadius: 20 },
                    !quickText.trim() && styles.quickSendBtnDisabled,
                  ]}
                >
                  <Ionicons name="arrow-up" size={19} color={Colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : null}
      </KeyboardAvoidingView>

      <AddEditPersonModal
        visible={showEditModal}
        person={person}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveEdit}
      />
    </SafeAreaView>
  );
}

function MentionMessageCard({
  item,
  people,
}: {
  item: PersonMentionThought;
  people: Person[];
}) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const attachmentPayload = parseAttachmentThought(item.content);
  const isAttachment = Boolean(attachmentPayload);
  const isLong = !isAttachment && item.content.length > 150;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push(`/thoughts/${item.day_date}` as any)}
      style={styles.messageCard}
    >
      {/* Top Meta Row: Date & Time */}
      <View style={styles.messageMetaRow}>
        <View style={[styles.datePill, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="calendar-outline" size={12} color={colors.primaryDark} />
          <AppText variant="caption" numberOfLines={1} style={[styles.datePillText, { color: colors.primaryDark }]}>
            {formatDateLabel(item.day_date, item.created_at)}
          </AppText>
        </View>

        <View style={styles.timeRow}>
          {item.is_starred && (
            <Ionicons name="star" size={12} color={colors.primary} style={{ marginRight: 2 }} />
          )}
          <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
          <AppText variant="caption" color={Colors.textMuted} style={styles.timeText}>
            {formatTime(item.created_at)}
          </AppText>
        </View>
      </View>

      {/* Body */}
      {isAttachment && attachmentPayload ? (
        <View style={styles.attachmentWrap}>
          <AttachmentCard payload={attachmentPayload} isSelected={false} people={people} />
        </View>
      ) : (
        <>
          <MentionText
            text={item.content}
            people={people}
            variant="body"
            color={Colors.text}
            numberOfLines={expanded ? undefined : 6}
            style={styles.thoughtBodyText}
            onPressMention={(mentioned) => router.push(`/people/${mentioned.id}` as any)}
            onPressTag={(tag) =>
              router.push({ pathname: '/(tabs)/thoughts' as any, params: { tag } })
            }
          />

          {isLong && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                setExpanded(!expanded);
              }}
              hitSlop={8}
              style={styles.readMoreRow}
            >
              <AppText
                variant="caption"
                color={colors.primaryDark}
                style={{ fontFamily: FontFamily.bold }}
              >
                {expanded ? 'Show less' : 'Read more'}
              </AppText>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={colors.primaryDark}
              />
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Footer */}
      <View style={styles.cardFooterRow}>
        <AppText variant="caption" color={Colors.textMuted}>
          Open day chat
        </AppText>
        <Feather name="arrow-right" size={13} color={colors.primaryDark} />
      </View>
    </TouchableOpacity>
  );
}

function DetailSkeletonLoader({ maxW }: { maxW?: number }) {
  const pulseAnim = React.useRef(new Animated.Value(0.35)).current;

  React.useEffect(() => {
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
      <Animated.View style={[styles.skeletonCard, { opacity: pulseAnim, height: 104 }]} />
      {[88, 68].map((w, idx) => (
        <Animated.View key={idx} style={[styles.skeletonCard, { opacity: pulseAnim }]}>
          <View style={[styles.skeletonLine, { width: `${w}%` }]} />
          <View style={[styles.skeletonLine, { width: `${w * 0.6}%`, marginTop: 8 }]} />
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
  headerBtnCompact: {
    width: 32,
    height: 32,
  },
  topCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[2],
  },
  topTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#241B14',
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: Spacing[2],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[6],
    gap: Spacing[3],
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[6],
    gap: Spacing[3],
  },

  profileCard: {
    gap: Spacing[3],
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    padding: Spacing[4],
    borderWidth: 1.5,
    borderColor: '#ECEAE4',
    shadowColor: '#2B261F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
  },
  profileAvatarWrap: {
    position: 'relative',
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceAlt,
  },
  profileAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: '#26221D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarSmall: {
    width: 62,
    height: 62,
  },
  editPhotoBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfoCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  profileName: {
    fontFamily: FontFamily.editorial,
    fontSize: 24,
    lineHeight: 29,
    color: '#241B14',
  },
  profileStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  mentionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  mentionPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.primaryDark,
  },
  relTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F1EC',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  relTagText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  notesBox: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderWidth: 1,
    borderColor: '#EFECE6',
  },

  coFilterRow: {
    gap: Spacing[2],
    paddingVertical: 2,
  },
  coChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#ECEAE4',
  },
  coChipActive: {
    backgroundColor: '#26221D',
    borderColor: '#26221D',
  },
  coChipText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  coChipTextActive: {
    color: Colors.white,
    fontFamily: FontFamily.bold,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginTop: Spacing[1],
  },
  sectionLabel: {
    letterSpacing: 0.8,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ECEAE4',
  },

  messageCard: {
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
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[2],
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    gap: 5,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  datePillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: Colors.primaryDark,
    flexShrink: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
  },
  attachmentWrap: {
    marginTop: 2,
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
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: Spacing[1],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EFECE6',
  },

  emptyMentions: {
    paddingVertical: Spacing[8],
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[1],
  },
  emptyTitle: {
    fontFamily: FontFamily.editorial,
    fontSize: 20,
    color: '#241B14',
    textAlign: 'center',
  },
  emptyText: {
    maxWidth: 290,
    lineHeight: 21,
    fontSize: FontSize.sm,
  },

  quickComposerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[1],
    backgroundColor: 'transparent',
  },
  quickComposerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing[2],
  },
  quickInputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    borderWidth: 1.5,
    borderColor: '#ECEAE4',
    paddingHorizontal: Spacing[3],
    minHeight: 44,
    gap: 6,
    ...Shadow.sm,
  },
  quickInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.text,
    maxHeight: 90,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
  },
  quickSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  quickSendBtnDisabled: {
    backgroundColor: '#D8D3C8',
    shadowOpacity: 0,
    elevation: 0,
  },

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
});
