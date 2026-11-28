import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '@/components/ui';
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '@/theme';
import { useThemeColors } from '@/hooks/use-mood-theme';
import type { DaySummary, ThoughtsStats } from '@/services/thoughts.service';
import { EMOTION_MAP } from '@/features/thoughts/utils/emotions';
import { TactileCardButton } from './AnimatedMotionPrimitives';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface WeeklyDayBarData {
  dayDate: string;
  weekday: string;
  count: number;
  isToday: boolean;
}

interface WeeklyRecapCardProps {
  stats: ThoughtsStats | null;
  days: DaySummary[];
  isSmallPhone?: boolean;
  onOpenDay: (dayDate: string) => void;
  onOpenTopPerson: (personId: string) => void;
  onOpenTopTag: (tag: string) => void;
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function AnimatedWeekBar({
  item,
  maxCount,
  barWidth,
  primaryColor,
  primaryDarkColor,
  onPress,
}: {
  item: WeeklyDayBarData;
  maxCount: number;
  barWidth: number;
  primaryColor: string;
  primaryDarkColor: string;
  onPress: () => void;
}) {
  const ratio = item.count > 0 ? Math.max(item.count / Math.max(maxCount, 1), 0.24) : 0.1;
  const heightAnim = useRef(new Animated.Value(ratio)).current;

  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: ratio,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [heightAnim, ratio]);

  const barHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <TactileCardButton
      onPress={onPress}
      style={styles.barColOuter}
      contentStyle={styles.barCol}
      scaleTo={0.93}
    >
      <AppText
        variant="caption"
        color={item.count > 0 ? Colors.text : Colors.textMuted}
        style={[styles.barCount, item.count === 0 && { opacity: 0 }]}
      >
        {item.count}
      </AppText>

      <View style={[styles.barTrack, { width: barWidth }]}>
        <Animated.View
          style={[
            styles.barFill,
            {
              height: barHeight,
              backgroundColor: item.count > 0 ? primaryColor : '#E5E1D8',
              opacity: item.count > 0 ? (item.isToday ? 1 : 0.78) : 1,
            },
          ]}
        />
      </View>

      <AppText
        variant="caption"
        color={item.isToday ? primaryDarkColor : Colors.textSecondary}
        style={[
          styles.barDayLabel,
          item.isToday && { fontFamily: FontFamily.bold },
        ]}
        numberOfLines={1}
      >
        {item.weekday}
      </AppText>
    </TactileCardButton>
  );
}

export function WeeklyRecapCard({
  stats,
  days,
  isSmallPhone = false,
  onOpenDay,
  onOpenTopPerson,
  onOpenTopTag,
}: WeeklyRecapCardProps) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const compact = isSmallPhone || width < 365;
  const stackSummary = width < 380;
  const barWidth = width < 350 ? 20 : width < 400 ? 24 : 28;

  const { weekBars, maxCount, computedWeeklyCount, computedActiveDays } = useMemo(() => {
    const countMap = new Map<string, number>();
    stats?.activeDays?.forEach((d) => {
      countMap.set(d.day_date, Math.max(countMap.get(d.day_date) || 0, d.count));
    });
    days.forEach((d) => {
      countMap.set(d.day_date, Math.max(countMap.get(d.day_date) || 0, d.thought_count));
    });

    const today = new Date();
    const todayStr = toLocalDateStr(today);
    const bars: WeeklyDayBarData[] = [];

    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      const dayDate = toLocalDateStr(d);
      bars.push({
        dayDate,
        weekday: DAY_LABELS[d.getDay()],
        count: countMap.get(dayDate) || 0,
        isToday: dayDate === todayStr,
      });
    }

    const peakVal = Math.max(...bars.map((r) => r.count), 1);
    const localWeekSum = bars.reduce((sum, b) => sum + b.count, 0);
    const localActiveCount = bars.filter((b) => b.count > 0).length;

    return {
      weekBars: bars,
      maxCount: peakVal,
      computedWeeklyCount: Math.max(stats?.weeklyCount ?? 0, localWeekSum),
      computedActiveDays: Math.max(stats?.activeDaysThisWeek ?? 0, localActiveCount),
    };
  }, [stats, days]);

  const topWeekMoodDef = stats?.topWeekMood ? EMOTION_MAP[stats.topWeekMood] : null;

  return (
    <View style={[styles.card, compact && { padding: Spacing[3] }]}>
      {/* Responsive Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTextCol}>
          <AppText style={[styles.title, compact && { fontSize: 18 }]}>
            Weekly Recap
          </AppText>
          <AppText variant="caption" color={Colors.textSecondary}>
            Last 7 days overview
          </AppText>
        </View>

        <View style={[styles.daysPill, { backgroundColor: colors.primary }]}>
          <AppText variant="caption" color={colors.textOnPrimary} style={styles.daysPillText}>
            {computedActiveDays} / 7 days
          </AppText>
        </View>
      </View>

      {/* Spacious 7-Day Activity Bars (explicit bar width so bars never collapse) */}
      <View style={styles.barsRow}>
        {weekBars.map((item) => (
          <AnimatedWeekBar
            key={item.dayDate}
            item={item}
            maxCount={maxCount}
            barWidth={barWidth}
            primaryColor={colors.primary}
            primaryDarkColor={colors.primaryDark}
            onPress={() => onOpenDay(item.dayDate)}
          />
        ))}
      </View>

      <View style={styles.divider} />

      {/* Clean Responsive 2-Column / Stacked Readable Metrics */}
      <View style={styles.summaryGrid}>
        {/* Thoughts this week */}
        <View
          style={[
            styles.summaryBox,
            { backgroundColor: colors.background },
            stackSummary ? styles.summaryBoxFull : styles.summaryBoxHalf,
          ]}
        >
          <AppText variant="caption" color={Colors.textSecondary} style={styles.summaryLabel}>
            Thoughts this week
          </AppText>
          <AppText style={styles.summaryBigNum}>{computedWeeklyCount}</AppText>
        </View>

        {/* Weekly vibe */}
        <View
          style={[
            styles.summaryBox,
            { backgroundColor: colors.background },
            stackSummary ? styles.summaryBoxFull : styles.summaryBoxHalf,
          ]}
        >
          <AppText variant="caption" color={Colors.textSecondary} style={styles.summaryLabel}>
            Weekly vibe
          </AppText>
          <AppText style={styles.summaryTextVal} numberOfLines={1}>
            {topWeekMoodDef ? `${topWeekMoodDef.emoji} ${topWeekMoodDef.label}` : 'Balanced'}
          </AppText>
        </View>

        {/* Top mention */}
        <TactileCardButton
          disabled={!stats?.topPerson}
          onPress={() => {
            if (stats?.topPerson) onOpenTopPerson(stats.topPerson.id);
          }}
          style={stackSummary ? styles.summaryBoxFull : styles.summaryBoxHalf}
          contentStyle={[
            styles.summaryBox,
            styles.summaryBoxTouch,
            { backgroundColor: colors.background },
          ]}
          scaleTo={0.97}
        >
          <AppText variant="caption" color={Colors.textSecondary} style={styles.summaryLabel}>
            Top mention
          </AppText>
          <View style={styles.valueActionRow}>
            <AppText style={styles.summaryTextVal} numberOfLines={1}>
              {stats?.topPerson ? stats.topPerson.name : 'No mentions yet'}
            </AppText>
            {stats?.topPerson && (
              <Feather name="arrow-up-right" size={15} color={colors.primaryDark} />
            )}
          </View>
        </TactileCardButton>

        {/* Top topic */}
        <TactileCardButton
          disabled={!stats?.topTag}
          onPress={() => {
            if (stats?.topTag) onOpenTopTag(stats.topTag.tag);
          }}
          style={stackSummary ? styles.summaryBoxFull : styles.summaryBoxHalf}
          contentStyle={[
            styles.summaryBox,
            styles.summaryBoxTouch,
            { backgroundColor: colors.background },
          ]}
          scaleTo={0.97}
        >
          <AppText variant="caption" color={Colors.textSecondary} style={styles.summaryLabel}>
            Top topic
          </AppText>
          <View style={styles.valueActionRow}>
            <AppText style={styles.summaryTextVal} numberOfLines={1}>
              {stats?.topTag ? `#${stats.topTag.tag}` : 'No topics yet'}
            </AppText>
            {stats?.topTag && (
              <Feather name="arrow-up-right" size={15} color={colors.primaryDark} />
            )}
          </View>
        </TactileCardButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: '#ECEAE4',
    gap: Spacing[4],
    ...Shadow.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[2],
    flexWrap: 'wrap',
  },
  headerTextCol: {
    flex: 1,
    minWidth: 130,
    gap: 2,
  },
  title: {
    fontFamily: FontFamily.editorialSemi,
    fontSize: 20,
    lineHeight: 26,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  daysPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    flexShrink: 0,
  },
  daysPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },

  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing[1],
    paddingTop: Spacing[1],
  },
  barColOuter: {
    flex: 1,
    minWidth: 0,
  },
  barCol: {
    width: '100%',
    alignItems: 'center',
    gap: 5,
  },
  barCount: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 68,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: 2,
  },
  barFill: {
    width: '100%',
    borderRadius: Radius.full,
    minHeight: 6,
  },
  barDayLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    lineHeight: 15,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ECEAE4',
  },

  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing[2],
  },
  summaryBoxHalf: {
    width: '48.5%',
  },
  summaryBoxFull: {
    width: '100%',
  },
  summaryBox: {
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    gap: 4,
  },
  summaryBoxTouch: {
    width: '100%',
  },
  summaryLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  summaryBigNum: {
    fontFamily: FontFamily.editorial,
    fontSize: 22,
    lineHeight: 28,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  summaryTextVal: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    lineHeight: 22,
    color: Colors.text,
    flexShrink: 1,
  },
  valueActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[2],
  },
});
