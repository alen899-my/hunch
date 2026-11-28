import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  useWindowDimensions,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppText,
  DatePickerModal,
  formatShortDateLabel,
  toLocalDateString,
} from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize, Shadow } from '@/theme';
import { useThoughts, useTags } from '@/hooks/use-thoughts';
import { useThemeColors } from '@/hooks/use-mood-theme';
import { usePeople } from '@/hooks/use-people';
import { useAuth } from '@/hooks/use-auth';
import * as thoughtsService from '@/services/thoughts.service';
import type { DaySummary, Thought } from '@/services/thoughts.service';
import {
  AttachmentCard,
  formatAttachmentPreview,
  parseAttachmentThought,
} from '../components/AttachmentCard';
import { EMOTION_MAP, parseEmotionThought } from '../utils/emotions';
import { MentionText } from '@/features/people/components/MentionText';
import { getSafeBottomPadding } from '@/utils/safe-area';

function formatPreview(content: string): string {
  if (!content) return '';
  return formatAttachmentPreview(content);
}

const TABLET = 600;

function formatDayDetails(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const todayStr = toLocalDateString(new Date());
  const isToday = dateStr === todayStr;

  return {
    dayName: days[dateObj.getDay()],
    dayNum: String(day).padStart(2, '0'),
    monthName: months[dateObj.getMonth()],
    formattedFull: dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
    isToday,
  };
}

function formatTime(isoStr: string) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type FilterMode = 'all' | 'starred' | 'image' | 'audio' | 'video';

export default function ThoughtsListScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET;
  const isSmallPhone = width < 370;

  const params = useLocalSearchParams<{ tag?: string }>();
  const { token } = useAuth();
  const { days, loading, fetchDays } = useThoughts();
  const { tags, fetchTags } = useTags();
  const { people } = usePeople();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchResults, setSearchResults] = useState<Thought[]>([]);
  const [searching, setSearching] = useState(false);

  const activeDates = useMemo(() => new Set(days.map((d) => d.day_date)), [days]);

  useEffect(() => {
    if (typeof params.tag === 'string' && params.tag.trim()) {
      setActiveTag(params.tag.trim().toLowerCase());
      setFilterMode('all');
    }
  }, [params.tag]);

  useFocusEffect(
    useCallback(() => {
      fetchDays(true);
      fetchTags(true);
    }, [fetchDays, fetchTags])
  );

  const isFilterActive =
    searchQuery.trim().length > 0 ||
    filterMode !== 'all' ||
    Boolean(activeTag) ||
    Boolean(selectedDate);

  useEffect(() => {
    if (!isFilterActive) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await thoughtsService.searchThoughts(
          {
            q: searchQuery.trim() || undefined,
            starred: filterMode === 'starred' ? true : undefined,
            type:
              filterMode === 'image' || filterMode === 'audio' || filterMode === 'video'
                ? filterMode
                : undefined,
            tag: activeTag || undefined,
            dayDate: selectedDate || undefined,
          },
          token
        );
        if (!cancelled && res.success && res.data?.thoughts) {
          setSearchResults(res.data.thoughts);
        }
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, searchQuery.trim() ? 220 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isFilterActive, searchQuery, filterMode, activeTag, selectedDate, token]);

  const maxW = isTablet ? 600 : undefined;
  const todayStr = toLocalDateString(new Date());
  const todayDetails = formatDayDetails(todayStr);

  const todayEntry = days.find((d) => d.day_date === todayStr);
  const previousDays = days.filter((d) => d.day_date !== todayStr);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDays(), fetchTags(true)]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* ── Header: Clean editorial title ── */}
      <View
        style={[
          styles.header,
          maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
        ]}
      >
        <AppText
          numberOfLines={1}
          style={[
            styles.mainTitle,
            isSmallPhone && { fontSize: 25, lineHeight: 31 },
            isTablet && { fontSize: 36, lineHeight: 42 },
          ]}
        >
          Daily Thoughts
        </AppText>
      </View>

      {/* ── Search & Filter Bar ─────────────────────────── */}
      {(days.length > 0 || isFilterActive) && (
        <View
          style={[
            styles.searchSection,
            maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
          ]}
        >
          <View style={styles.searchPill}>
            <Ionicons name="search-outline" size={17} color={Colors.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search thoughts, @people, or #tags..."
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isFilterActive && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setFilterMode('all');
                  setActiveTag(null);
                  setSelectedDate(null);
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsRow}
          >
            {/* Date Picker Filter Chip */}
            <View
              style={[
                styles.filterChip,
                styles.dateFilterChip,
                { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
                selectedDate && [
                  styles.filterChipDateActive,
                  { backgroundColor: colors.primary, borderColor: colors.primary },
                ],
              ]}
            >
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.8}
                style={styles.dateChipMainTap}
              >
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={selectedDate ? Colors.white : colors.primaryDark}
                />
                <AppText
                  variant="caption"
                  style={[
                    styles.filterChipText,
                    selectedDate && styles.filterChipTextActive,
                  ]}
                >
                  {selectedDate ? formatShortDateLabel(selectedDate) : 'Date'}
                </AppText>
              </TouchableOpacity>
              {selectedDate && (
                <TouchableOpacity
                  onPress={() => setSelectedDate(null)}
                  hitSlop={8}
                  style={styles.chipClearTap}
                >
                  <Ionicons name="close" size={13} color={Colors.white} />
                </TouchableOpacity>
              )}
            </View>

            {(
              [
                { key: 'all', label: 'All' },
                { key: 'starred', label: 'Starred' },
                { key: 'image', label: 'Photos' },
                { key: 'audio', label: 'Audio' },
                { key: 'video', label: 'Videos' },
              ] as const
            ).map((f) => {
              const selected = filterMode === f.key && !activeTag;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => {
                    setFilterMode(f.key);
                    setActiveTag(null);
                  }}
                  activeOpacity={0.8}
                  style={[styles.filterChip, selected && styles.filterChipActive]}
                >
                  <AppText
                    variant="caption"
                    style={[styles.filterChipText, selected && styles.filterChipTextActive]}
                  >
                    {f.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}

            {tags.slice(0, 8).map((t) => {
              const selected = activeTag === t.tag;
              return (
                <TouchableOpacity
                  key={t.tag}
                  onPress={() => {
                    setActiveTag(selected ? null : t.tag);
                    setFilterMode('all');
                  }}
                  activeOpacity={0.8}
                  style={[styles.filterChip, selected && styles.filterChipTagActive]}
                >
                  <AppText
                    variant="caption"
                    style={[styles.filterChipText, selected && styles.filterChipTagTextActive]}
                  >
                    #{t.tag} ({t.count})
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Main Content ───────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {isFilterActive ? (
          /* ── Search & Filtered Results View ── */
          <View style={styles.pastSection}>
            <View style={styles.sectionHeaderRow}>
              <AppText variant="label" color={Colors.textMuted} style={styles.sectionLabel}>
                {searching
                  ? 'SEARCHING...'
                  : `${searchResults.length} ${
                      searchResults.length === 1 ? 'MATCH' : 'MATCHES'
                    }${selectedDate ? ` • ${formatShortDateLabel(selectedDate).toUpperCase()}` : ''}`}
              </AppText>
              <View style={styles.sectionLine} />
              {selectedDate && (
                <TouchableOpacity
                  onPress={() => router.push(`/thoughts/${selectedDate}` as any)}
                  activeOpacity={0.75}
                  style={[styles.openSelectedDayBtn, { backgroundColor: colors.primaryLight }]}
                >
                  <AppText variant="caption" style={[styles.openSelectedDayText, { color: colors.primaryDark }]}>
                    Open Chat
                  </AppText>
                  <Ionicons name="arrow-forward" size={12} color={colors.primaryDark} />
                </TouchableOpacity>
              )}
            </View>

            {searching ? (
              <View style={styles.searchLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.emptySearchBox}>
                <Ionicons name="search-outline" size={32} color={Colors.textMuted} />
                <AppText variant="title" style={{ color: '#241B14' }}>
                  No matching thoughts
                </AppText>
                <AppText variant="caption" color={Colors.textSecondary} align="center">
                  Try another keyword, date, or clear the active filter.
                </AppText>
              </View>
            ) : (
              searchResults.map((item) => {
                const attachmentPayload = parseAttachmentThought(item.content);
                const emotionPayload = parseEmotionThought(item.content);
                const emotionDef = item.mood ? EMOTION_MAP[item.mood] : undefined;
                return (
                  <View key={item.id} style={styles.searchCard}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => router.push(`/thoughts/${item.day_date}` as any)}
                      style={styles.searchCardTop}
                    >
                      <View style={[styles.searchDateBadge, { backgroundColor: colors.primaryLight }]}>
                        <Ionicons name="calendar-outline" size={11} color={colors.primaryDark} />
                        <AppText variant="caption" numberOfLines={1} style={[styles.searchDateText, { color: colors.primaryDark }]}>
                          {formatShortDateLabel(item.day_date)}
                        </AppText>
                      </View>
                      <View style={styles.searchMetaRight}>
                        {item.mood && !emotionPayload && (
                          <View
                            style={[
                              styles.moodTagMini,
                              { backgroundColor: colors.primary },
                              emotionDef ? { backgroundColor: emotionDef.color } : null,
                            ]}
                          >
                            <AppText variant="caption" style={styles.moodTagMiniText}>
                              {emotionDef ? `${emotionDef.emoji} ${emotionDef.label}` : item.mood}
                            </AppText>
                          </View>
                        )}
                        {item.is_starred && (
                          <Ionicons name="star" size={13} color={colors.primary} />
                        )}
                        <AppText variant="caption" color={Colors.textMuted}>
                          {formatTime(item.created_at)}
                        </AppText>
                        <Feather name="chevron-right" size={13} color={Colors.textMuted} />
                      </View>
                    </TouchableOpacity>

                    {emotionPayload ? (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => router.push(`/thoughts/${item.day_date}` as any)}
                        style={[
                          styles.emotionSearchRow,
                          {
                            backgroundColor:
                              EMOTION_MAP[emotionPayload.mood]?.color || colors.primary,
                          },
                        ]}
                      >
                        <AppText style={styles.emotionSearchEmoji}>{emotionPayload.emoji}</AppText>
                        <AppText variant="bodyMd" style={styles.emotionSearchLabel}>
                          Feeling {emotionPayload.label}
                        </AppText>
                      </TouchableOpacity>
                    ) : attachmentPayload ? (
                      <AttachmentCard
                        payload={attachmentPayload}
                        isSelected={false}
                        people={people}
                        fullWidth
                        onPressMention={(p) => router.push(`/people/${p.id}` as any)}
                        onPressTag={(tag) => setActiveTag(tag)}
                      />
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => router.push(`/thoughts/${item.day_date}` as any)}
                      >
                        <MentionText
                          text={item.content}
                          people={people}
                          variant="body"
                          color={Colors.text}
                          numberOfLines={4}
                          onPressMention={(p) => router.push(`/people/${p.id}` as any)}
                          onPressTag={(tag) => setActiveTag(tag)}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <>
            {/* ── Today's Card with SOLID FILL COLORED BG & Left Date Badge ── */}
            <TodayHeroCard
              todayStr={todayStr}
              todayEntry={todayEntry}
              todayDetails={todayDetails}
              isSmallPhone={isSmallPhone}
            />

            {/* ── Previous Days List with Left Date Badge & Just Count Number ── */}
            {previousDays.length > 0 && (
              <View style={styles.pastSection}>
                <View style={styles.sectionHeaderRow}>
                  <AppText variant="label" color={Colors.textMuted} style={styles.sectionLabel}>
                    PREVIOUS DAYS
                  </AppText>
                  <View style={styles.sectionLine} />
                </View>

                {previousDays.map((item) => (
                  <DayThoughtCard
                    key={item.day_date}
                    item={item}
                    isSmallPhone={isSmallPhone}
                  />
                ))}
              </View>
            )}

            {/* If completely empty */}
            {!todayEntry && previousDays.length === 0 && !loading && (
              <View style={styles.emptyContainer}>
                <Image
                  source={require('../../../../assets/images/empty-thoughts.png')}
                  style={styles.emptyIllustration}
                  resizeMode="contain"
                />
                <AppText style={styles.emptyTitle}>Fresh beginnings</AppText>
                <AppText
                  variant="body"
                  color={Colors.textSecondary}
                  align="center"
                  style={styles.emptySubtext}
                >
                  Start by typing your first thought for today above.
                </AppText>
              </View>
            )}
          </>
        )}

        {/* Tab bar bottom offset */}
        <View style={{ height: getSafeBottomPadding(insets.bottom, 108, 136, 124) }} />
      </ScrollView>

      <DatePickerModal
        visible={showDatePicker}
        selectedDate={selectedDate}
        activeDates={activeDates}
        title="Filter by Date"
        subtitle="Select any day to filter thoughts & media"
        allowClear
        onSelectDate={(pickedDate) => setSelectedDate(pickedDate)}
        onClear={() => setSelectedDate(null)}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}

// ── Today's Card with SOLID FILL COLORED BACKGROUND & Left Date Badge ──
function TodayHeroCard({
  todayStr,
  todayEntry,
  todayDetails,
  isSmallPhone,
}: {
  todayStr: string;
  todayEntry?: DaySummary;
  todayDetails: ReturnType<typeof formatDayDetails>;
  isSmallPhone: boolean;
}) {
  const colors = useThemeColors();
  const hasThoughts = Boolean(todayEntry && todayEntry.thought_count > 0);
  const [expanded, setExpanded] = useState(false);
  const previewText = formatPreview(todayEntry?.latest_preview || '');
  const isLong = Boolean(previewText && previewText.length > 90);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => router.push(`/thoughts/${todayStr}` as any)}
      style={[
        styles.cardTodaySolid,
        { backgroundColor: colors.primary, shadowColor: colors.primary },
      ]}
    >
      <View style={styles.cardInner}>
        {/* Left Side: Semi-rounded Solid Date Badge (DAY, NUM, MONTH) */}
        <View style={[styles.solidDateBadgeToday, isSmallPhone && styles.solidDateBadgeSmall]}>
          <AppText variant="caption" style={styles.badgeDayNameToday}>
            {todayDetails.dayName}
          </AppText>
          <AppText
            variant="h3"
            style={[styles.badgeDayNumToday, isSmallPhone && { fontSize: FontSize.lg, lineHeight: 22 }]}
          >
            {todayDetails.dayNum}
          </AppText>
          <AppText variant="caption" style={styles.badgeMonthToday}>
            {todayDetails.monthName}
          </AppText>
        </View>

        {/* Right Content */}
        <View style={styles.cardBody}>
          {hasThoughts ? (
            <>
              {/* Top row: Updated Time + Just Count Number (NO dots) */}
              <View style={styles.cardTopRow}>
                <AppText variant="caption" style={styles.todayTimeTextWhite}>
                  {formatTime(todayEntry!.last_updated)}
                </AppText>

                {/* Just count number badge */}
                <View style={styles.justCountBadgeTodayWhite}>
                  <AppText variant="caption" style={styles.justCountTextTodayWhite}>
                    {todayEntry!.thought_count}
                  </AppText>
                </View>
              </View>

              {/* Thought preview in crisp white text */}
              <AppText
                variant="body"
                numberOfLines={expanded ? undefined : 2}
                style={styles.todayPreviewTextWhite}
              >
                {previewText}
              </AppText>

              {/* Footer: Read more / Continue sharing */}
              <View style={styles.todayFooterRowWhite}>
                {isLong ? (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setExpanded(!expanded);
                    }}
                    hitSlop={8}
                    style={styles.readMoreBtnWhite}
                  >
                    <AppText variant="caption" style={styles.readMoreTextWhite}>
                      {expanded ? 'Show less' : 'Read more'}
                    </AppText>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={13}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                ) : (
                  <View />
                )}

                <View style={styles.continuePillWhite}>
                  <AppText variant="caption" style={styles.continueTextWhite}>
                    Continue sharing
                  </AppText>
                  <Feather name="arrow-right" size={13} color="#FFFFFF" />
                </View>
              </View>
            </>
          ) : (
            /* Empty Today: Clean theme-matching prompt (NO dots) */
            <View style={styles.todayEmptyCol}>
              <View style={styles.todayPillBadge}>
                <AppText variant="label" style={styles.todayPillBadgeText}>
                  TODAY
                </AppText>
              </View>

              <AppText
                variant="bodyMd"
                style={[styles.todayEmptyPromptTitle, isSmallPhone && { fontSize: FontSize.sm }]}
                numberOfLines={1}
              >
                What's on your mind?
              </AppText>

              <View style={styles.todayTapRow}>
                <AppText variant="caption" style={styles.todayTapText}>
                  Tap to write today's thought
                </AppText>
                <Feather name="arrow-right" size={13} color="rgba(255,255,255,0.9)" />
              </View>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Previous Days Thought Card (Left Solid Date Badge & Just Count Number) ──
function DayThoughtCard({
  item,
  isSmallPhone,
}: {
  item: DaySummary;
  isSmallPhone: boolean;
}) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const { dayName, dayNum, monthName } = formatDayDetails(item.day_date);
  const previewText = formatPreview(item.latest_preview || '');
  const isLong = previewText && previewText.length > 90;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => router.push(`/thoughts/${item.day_date}` as any)}
      style={styles.card3D}
    >
      <View style={styles.cardInner}>
        {/* Left: Semi-rounded solid colored shape displaying day & date */}
        <View style={[styles.solidDateBadge, isSmallPhone && styles.solidDateBadgeSmall]}>
          <AppText variant="caption" style={styles.badgeDayName}>
            {dayName}
          </AppText>
          <AppText
            variant="h3"
            style={[styles.badgeDayNum, isSmallPhone && { fontSize: FontSize.lg, lineHeight: 22 }]}
          >
            {dayNum}
          </AppText>
          <AppText variant="caption" style={styles.badgeMonth}>
            {monthName}
          </AppText>
        </View>

        {/* Right Content */}
        <View style={styles.cardBody}>
          {/* Top row: Timestamp + JUST COUNT NUMBER */}
          <View style={styles.cardTopRow}>
            <AppText variant="caption" color={Colors.textMuted} style={styles.timeText}>
              {formatTime(item.last_updated)}
            </AppText>

            {/* Only show just the count number — no "messages" text */}
            <View style={styles.justCountBadge}>
              <AppText variant="caption" style={styles.justCountText}>
                {item.thought_count}
              </AppText>
            </View>
          </View>

          {/* Thought content preview */}
          <AppText
            variant="body"
            color={Colors.text}
            numberOfLines={expanded ? undefined : 2}
            style={styles.previewText}
          >
            {previewText}
          </AppText>

          {/* Read more toggle if long content */}
          {isLong && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                setExpanded(!expanded);
              }}
              hitSlop={8}
              style={styles.readMoreBtn}
            >
              <AppText variant="caption" color={colors.primaryDark} style={{ fontFamily: FontFamily.semiBold }}>
                {expanded ? 'Show less' : 'Read more'}
              </AppText>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={colors.primaryDark}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[3],
  },
  searchSection: {
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[3],
    gap: Spacing[2],
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: '#ECEAE4',
    paddingHorizontal: Spacing[4],
    height: 42,
    gap: Spacing[2],
    ...Shadow.xs,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.text,
    height: '100%',
  },
  filterChipsRow: {
    gap: Spacing[2],
    paddingRight: Spacing[4],
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#ECEAE4',
  },
  dateFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primarySoft,
  },
  dateChipMainTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  filterChipDateActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipClearTap: {
    marginLeft: 2,
    paddingLeft: 2,
  },
  openSelectedDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    flexShrink: 0,
  },
  openSelectedDayText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.primaryDark,
  },
  moodTagMini: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  moodTagMiniText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.white,
    textTransform: 'capitalize',
  },
  emotionSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
  },
  emotionSearchEmoji: {
    fontSize: 28,
    lineHeight: 34,
  },
  emotionSearchLabel: {
    fontFamily: FontFamily.bold,
    color: Colors.white,
    fontSize: FontSize.md,
  },
  filterChipActive: {
    backgroundColor: '#26221D',
    borderColor: '#26221D',
  },
  filterChipTagActive: {
    backgroundColor: Colors.tagPurple,
    borderColor: Colors.tagPurpleText,
  },
  filterChipText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
    fontFamily: FontFamily.bold,
  },
  filterChipTagTextActive: {
    color: Colors.tagPurpleText,
    fontFamily: FontFamily.bold,
  },
  searchLoader: {
    paddingVertical: Spacing[8],
    alignItems: 'center',
  },
  emptySearchBox: {
    paddingVertical: Spacing[8],
    alignItems: 'center',
    gap: Spacing[2],
  },
  searchCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    borderWidth: 1.5,
    borderColor: '#ECEAE4',
    gap: Spacing[2],
    ...Shadow.xs,
  },
  searchCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[2],
  },
  searchDateBadge: {
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
  searchDateText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: Colors.primaryDark,
    flexShrink: 1,
  },
  searchMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
  },
  mainTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: FontFamily.editorial,
    fontSize: 29,
    lineHeight: 35,
    color: '#241B14', // Distinct rich warm espresso heading
    letterSpacing: -0.7,
  },
  scrollContent: {
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[2],
    gap: Spacing[4],
  },

  // ── Today Card with SOLID FILL COLORED BACKGROUND ──
  cardTodaySolid: {
    backgroundColor: Colors.primary, // Solid Fill Amber Colored BG
    borderRadius: Radius['2xl'],
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
    overflow: 'hidden',
  },
  solidDateBadgeToday: {
    width: 62,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[3],
    gap: 1,
    backgroundColor: '#26221D', // High-contrast solid dark badge on solid amber bg
  },
  badgeDayNameToday: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
  },
  badgeDayNumToday: {
    color: '#FFFFFF',
    fontFamily: FontFamily.black,
    lineHeight: 26,
  },
  badgeMonthToday: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
  },
  todayPillBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  todayPillBadgeText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  todayTimeTextWhite: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontFamily: FontFamily.medium,
  },
  justCountBadgeTodayWhite: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  justCountTextTodayWhite: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  todayPreviewTextWhite: {
    fontSize: FontSize.md,
    lineHeight: 21,
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
  },
  todayFooterRowWhite: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing[2],
    paddingTop: Spacing[1],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
  },
  readMoreBtnWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readMoreTextWhite: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 12,
  },
  continuePillWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  continueTextWhite: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  todayEmptyCol: {
    gap: 4,
    justifyContent: 'center',
  },
  todayEmptyPromptTitle: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSize.md,
    lineHeight: 20,
  },
  todayTapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  todayTapText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },

  // ── Past Section ───────────────────────────────────
  pastSection: {
    gap: Spacing[3],
    marginTop: Spacing[1],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginBottom: Spacing[1],
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

  // ── 3D Tactile Card (Past entries) ─────────────────
  card3D: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    borderWidth: 1.5,
    borderColor: '#ECEAE4',
    shadowColor: '#2B261F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    padding: Spacing[3],
    gap: Spacing[3],
    alignItems: 'stretch',
  },
  solidDateBadge: {
    width: 62,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[3],
    gap: 1,
    backgroundColor: '#26221D', // Matching dark charcoal theme badge
  },
  solidDateBadgeSmall: {
    width: 52,
    paddingVertical: Spacing[2],
  },
  badgeDayName: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
  },
  badgeDayNum: {
    color: Colors.white,
    fontFamily: FontFamily.black,
    lineHeight: 26,
  },
  badgeMonth: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
  },

  // Card Body
  cardBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
  },

  // Just Count Number Badge (no "messages" word)
  justCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F3F1EC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  justCountText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.textSecondary,
  },

  previewText: {
    lineHeight: 20,
    fontSize: 13,
  },
  readMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },

  // ── Empty state with transparent illustration ───────
  emptyContainer: {
    paddingVertical: Spacing[8],
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
  },
  emptyIllustration: {
    width: 140,
    height: 115,
    marginBottom: Spacing[1],
  },
  emptyTitle: {
    fontFamily: FontFamily.editorial,
    fontSize: 20,
    color: '#241B14',
    textAlign: 'center',
  },
  emptySubtext: {
    width: '100%',
    maxWidth: 280,
    lineHeight: 20,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});
