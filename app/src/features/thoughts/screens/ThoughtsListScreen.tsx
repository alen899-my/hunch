import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  RefreshControl,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize, Shadow } from '@/theme';
import { useThoughts } from '@/hooks/use-thoughts';
import type { DaySummary } from '@/services/thoughts.service';
import { formatAttachmentPreview } from '../components/AttachmentCard';

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

  const todayStr = new Date().toISOString().split('T')[0];
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

export default function ThoughtsListScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET;
  const isSmallPhone = width < 370;

  const { days, loading, fetchDays } = useThoughts();
  const [refreshing, setRefreshing] = useState(false);
  const maxW = isTablet ? 600 : undefined;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayDetails = formatDayDetails(todayStr);

  const todayEntry = days.find((d) => d.day_date === todayStr);
  const previousDays = days.filter((d) => d.day_date !== todayStr);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDays();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header: Clean title ── */}
      <View
        style={[
          styles.header,
          maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
        ]}
      >
        <AppText style={[styles.mainTitle, isTablet && { fontSize: 36, lineHeight: 42 }]}>
          Daily Thoughts
        </AppText>
      </View>

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
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
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

        {/* If completely empty: Replaced icon with transparent background cutout image */}
        {!todayEntry && previousDays.length === 0 && !loading && (
          <View style={styles.emptyContainer}>
            <Image
              source={require('../../../../assets/images/empty-thoughts.png')}
              style={styles.emptyIllustration}
              resizeMode="contain"
            />
            <AppText style={styles.emptyTitle}>
              Fresh beginnings
            </AppText>
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

        {/* Tab bar bottom offset */}
        <View style={{ height: 110 }} />
      </ScrollView>
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
  const hasThoughts = Boolean(todayEntry && todayEntry.thought_count > 0);
  const [expanded, setExpanded] = useState(false);
  const previewText = formatPreview(todayEntry?.latest_preview || '');
  const isLong = Boolean(previewText && previewText.length > 90);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => router.push(`/thoughts/${todayStr}` as any)}
      style={styles.cardTodaySolid}
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
              <AppText variant="caption" color={Colors.primaryDark} style={{ fontFamily: FontFamily.semiBold }}>
                {expanded ? 'Show less' : 'Read more'}
              </AppText>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={Colors.primaryDark}
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
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[3],
  },
  mainTitle: {
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
