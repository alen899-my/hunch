import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppText } from '@/components/ui';
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '@/theme';
import type { ThoughtMood } from '@/services/thoughts.service';
import { EMOTION_LIST, type EmotionDef } from '@/features/thoughts/utils/emotions';
import { TactileCardButton } from './AnimatedMotionPrimitives';

interface EmotionStatItem extends EmotionDef {
  count: number;
  pct: number;
}

interface EmotionMeterCardProps {
  moodCounts: { mood: ThoughtMood; count: number }[];
  latestMood: ThoughtMood | null;
  onSelectMood: (mood: ThoughtMood) => void;
  isSmallPhone?: boolean;
}

function SpectrumSlice({ color, ratio }: { color: string; ratio: number }) {
  const flexAnim = useRef(new Animated.Value(ratio)).current;

  useEffect(() => {
    Animated.timing(flexAnim, {
      toValue: ratio,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [flexAnim, ratio]);

  return (
    <Animated.View
      style={[
        styles.spectrumSlice,
        {
          flex: flexAnim,
          backgroundColor: color,
        },
      ]}
    />
  );
}

function AnimatedEmotionRow({
  item,
  maxPct,
  hasData,
  compact,
  onPress,
}: {
  item: EmotionStatItem;
  maxPct: number;
  hasData: boolean;
  compact: boolean;
  onPress: () => void;
}) {
  const isPopulated = hasData && item.count > 0;
  const targetRatio = isPopulated ? Math.max(item.pct / Math.max(maxPct, 1), 0.14) : 0.08;
  const widthAnim = useRef(new Animated.Value(targetRatio)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: targetRatio,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [widthAnim, targetRatio]);

  const fillWidth = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <TactileCardButton
      onPress={onPress}
      style={styles.rowButtonWrap}
      contentStyle={[
        styles.emotionRow,
        compact && { paddingVertical: 6, gap: Spacing[2] },
      ]}
      scaleTo={0.97}
    >
      {/* Solid Individual Mood Emoji Dot */}
      <View
        style={[
          styles.emojiDot,
          {
            backgroundColor: item.color,
            opacity: isPopulated || !hasData ? 1 : 0.75,
          },
        ]}
      >
        <AppText style={styles.emojiChar}>{item.emoji}</AppText>
      </View>

      {/* Full Mood Label (always legible, never squeezed into 40px) */}
      <AppText
        variant="label"
        color={isPopulated ? Colors.text : Colors.textSecondary}
        style={[
          styles.rowLabel,
          compact && { width: 66, fontSize: 12 },
          isPopulated && { fontFamily: FontFamily.semiBold },
        ]}
        numberOfLines={1}
      >
        {item.label}
      </AppText>

      {/* Responsive Animated Track */}
      <View style={styles.rowTrack}>
        <Animated.View
          style={[
            styles.rowFill,
            {
              width: fillWidth,
              backgroundColor: item.color,
              opacity: isPopulated ? 1 : 0.28,
            },
          ]}
        />
      </View>

      {/* Solid Tabular % Readout */}
      <View style={[styles.pctWrap, compact && { minWidth: 42 }]}>
        <AppText
          variant="caption"
          color={isPopulated ? Colors.text : Colors.textMuted}
          style={[
            styles.pctText,
            isPopulated && { fontFamily: FontFamily.bold },
          ]}
        >
          {hasData ? `${item.pct}%` : '—'}
        </AppText>
      </View>
    </TactileCardButton>
  );
}

export function EmotionMeterCard({
  moodCounts,
  latestMood,
  onSelectMood,
  isSmallPhone = false,
}: EmotionMeterCardProps) {
  const { width } = useWindowDimensions();
  const isTwoCol = width >= 560;
  const compact = isSmallPhone || width < 365;

  const { orderedItems, totalCount, dominant, activeSegments, maxPct } = useMemo(() => {
    const countMap = new Map<string, number>();
    moodCounts.forEach((m) => countMap.set(m.mood, m.count));

    const total = [...countMap.values()].reduce((acc, c) => acc + c, 0);
    const allItems: EmotionStatItem[] = EMOTION_LIST.map((def) => {
      const count = countMap.get(def.key) || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return { ...def, count, pct };
    });

    const sorted = [...allItems].sort((a, b) => b.count - a.count);
    const fallbackMood = latestMood
      ? allItems.find((i) => i.key === latestMood) || allItems[2]
      : allItems[2];

    const populated = sorted.filter((i) => i.count > 0);
    const peakPct = Math.max(...sorted.map((i) => i.pct), 1);

    return {
      orderedItems: sorted,
      totalCount: total,
      dominant: total > 0 ? sorted[0] : fallbackMood,
      activeSegments: populated,
      maxPct: peakPct,
    };
  }, [moodCounts, latestMood]);

  return (
    <View style={[styles.card, compact && { padding: Spacing[3] }]}>
      {/* Responsive Header (wraps naturally, never clips) */}
      <View style={styles.header}>
        <AppText style={[styles.title, compact && { fontSize: 18 }]}>
          Emotion Meter
        </AppText>
        <AppText variant="caption" color={Colors.textSecondary} style={styles.subtitle}>
          {totalCount > 0
            ? `Mostly ${dominant.emoji} ${dominant.label} (${dominant.pct}%) · ${totalCount} ${
                totalCount === 1 ? 'check-in' : 'check-ins'
              }`
            : 'Tap any emotion below to log how you feel'}
        </AppText>
      </View>

      {/* Proportional Individual Emotion Colors Meter */}
      <View style={styles.spectrumTrack}>
        {activeSegments.length > 0 ? (
          activeSegments.map((seg) => (
            <SpectrumSlice
              key={seg.key}
              color={seg.color}
              ratio={Math.max(seg.count / Math.max(totalCount, 1), 0.04)}
            />
          ))
        ) : (
          <View
            style={[
              styles.spectrumSlice,
              { width: '20%', backgroundColor: '#DCD8CE' },
            ]}
          />
        )}
      </View>

      {/* All 9 Emotions Fully Visible & Responsive (1-col on phone, 2-col on wide/tablet) */}
      <View style={[styles.listGrid, isTwoCol && styles.listGridTwoCol]}>
        {orderedItems.map((item) => (
          <View
            key={item.key}
            style={isTwoCol ? styles.gridItemHalf : styles.gridItemFull}
          >
            <AnimatedEmotionRow
              item={item}
              maxPct={maxPct}
              hasData={totalCount > 0}
              compact={compact}
              onPress={() => onSelectMood(item.key)}
            />
          </View>
        ))}
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
    gap: Spacing[3],
    ...Shadow.xs,
  },
  header: {
    gap: 3,
  },
  title: {
    fontFamily: FontFamily.editorialSemi,
    fontSize: 20,
    lineHeight: 26,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },

  spectrumTrack: {
    height: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 2,
  },
  spectrumSlice: {
    height: '100%',
    borderRadius: Radius.full,
  },

  listGrid: {
    gap: 4,
    paddingTop: Spacing[1],
  },
  listGridTwoCol: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing[2],
  },
  gridItemFull: {
    width: '100%',
  },
  gridItemHalf: {
    width: '48.5%',
  },

  rowButtonWrap: {
    width: '100%',
  },
  emotionRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: Radius.md,
  },
  emojiDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emojiChar: {
    fontSize: 15,
  },
  rowLabel: {
    width: 74,
    flexShrink: 0,
    fontSize: 13,
    lineHeight: 18,
  },
  rowTrack: {
    flex: 1,
    minWidth: 40,
    height: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    overflow: 'hidden',
  },
  rowFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  pctWrap: {
    minWidth: 44,
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  pctText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
