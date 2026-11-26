import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  RefreshControl,
  Alert,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize, Shadow } from '@/theme';
import { usePeople, usePersonDetails, type SavePersonInput } from '@/hooks/use-people';
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
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const personId = typeof id === 'string' ? id : '';

  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET;
  const isSmallPhone = width < 370;
  const maxW = isTablet ? 580 : undefined;

  const { people, editPerson, removePerson } = usePeople();
  const { person, mentions, loading, error, setPerson, fetchDetails } =
    usePersonDetails(personId);

  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

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

  const todayStr = new Date().toISOString().split('T')[0];
  const safeBottom = getSafeBottomPadding(insets.bottom, Spacing[8], 56, 40);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Clean Top Bar (Matching ThoughtChatScreen) ── */}
      <View
        style={[
          styles.topBar,
          maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
        ]}
      >
        <TouchableOpacity
          onPress={handleBack}
          style={styles.headerBtn}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.topCenter}>
          <AppText variant="title" numberOfLines={1} style={styles.topTitle}>
            {person?.name || 'Person'}
          </AppText>
        </View>

        <View style={styles.headerRightRow}>
          {person && (
            <>
              <TouchableOpacity
                onPress={() => setShowEditModal(true)}
                style={styles.headerBtn}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Feather name="edit-2" size={17} color={Colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDeletePerson}
                style={styles.headerBtn}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Feather name="trash-2" size={17} color="#D93838" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

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
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: safeBottom },
            maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {/* ── Person Summary Card ── */}
          <View style={styles.profileCard}>
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
              <View style={styles.editPhotoBadge}>
                <Ionicons name="camera" size={12} color={Colors.white} />
              </View>
            </TouchableOpacity>

            <View style={styles.profileInfoCol}>
              <AppText style={[styles.profileName, isSmallPhone && { fontSize: 21 }]}>
                {person.name}
              </AppText>
              <AppText variant="label" color={Colors.textSecondary}>
                @{person.handle}
              </AppText>
              <View style={styles.profileStatsRow}>
                <View style={styles.mentionPill}>
                  <Ionicons name="at" size={13} color={Colors.primaryDark} />
                  <AppText variant="caption" style={styles.mentionPillText}>
                    {mentions.length} {mentions.length === 1 ? 'mention' : 'mentions'}
                  </AppText>
                </View>
              </View>
            </View>
          </View>

          {/* ── Mentioned Messages Stream ── */}
          <View style={styles.sectionHeaderRow}>
            <AppText variant="label" color={Colors.textMuted} style={styles.sectionLabel}>
              MENTIONED MESSAGES
            </AppText>
            <View style={styles.sectionLine} />
          </View>

          {mentions.length === 0 ? (
            <View style={styles.emptyMentions}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="chatbubble-ellipses-outline" size={30} color={Colors.primary} />
              </View>
              <AppText style={styles.emptyTitle}>Nothing mentioned yet</AppText>
              <AppText
                variant="body"
                color={Colors.textSecondary}
                align="center"
                style={styles.emptyText}
              >
                Type @{person.name} in any daily thought chat and those messages will appear right here.
              </AppText>
              <Button
                label="Write in Today's Chat"
                variant="primary"
                size="md"
                fullWidth={false}
                onPress={() => router.push(`/thoughts/${todayStr}` as any)}
                leftIcon={<Ionicons name="chatbubbles-outline" size={18} color={Colors.white} />}
                style={{ marginTop: Spacing[2], paddingHorizontal: Spacing[5] }}
              />
            </View>
          ) : (
            mentions.map((item) => (
              <MentionMessageCard
                key={item.id}
                item={item}
                people={people.length > 0 ? people : [person]}
              />
            ))
          )}
        </ScrollView>
      ) : null}

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
        <View style={styles.datePill}>
          <Ionicons name="calendar-outline" size={12} color={Colors.primaryDark} />
          <AppText variant="caption" style={styles.datePillText}>
            {formatDateLabel(item.day_date, item.created_at)}
          </AppText>
        </View>

        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
          <AppText variant="caption" color={Colors.textMuted} style={styles.timeText}>
            {formatTime(item.created_at)}
          </AppText>
        </View>
      </View>

      {/* Body: Attachment or Handwriting Thought Text with Highlighted @Mentions */}
      {isAttachment && attachmentPayload ? (
        <View style={styles.attachmentWrap}>
          <AttachmentCard payload={attachmentPayload} isSelected={false} />
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
                color={Colors.primaryDark}
                style={{ fontFamily: FontFamily.bold }}
              >
                {expanded ? 'Show less' : 'Read more'}
              </AppText>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={Colors.primaryDark}
              />
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Footer: Jump to day's chat */}
      <View style={styles.cardFooterRow}>
        <AppText variant="caption" color={Colors.textMuted}>
          Open day chat
        </AppText>
        <Feather name="arrow-right" size={13} color={Colors.primaryDark} />
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
  topCenter: {
    flex: 1,
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
    gap: Spacing[2],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[8],
    gap: Spacing[3],
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[6],
    gap: Spacing[3],
  },

  // ── Profile Summary Card ──
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
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
    alignItems: 'center',
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

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginTop: Spacing[2],
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

  // ── Mentioned Message Card ──
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
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
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

  // ── Empty State ──
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

  // ── Skeleton ──
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
