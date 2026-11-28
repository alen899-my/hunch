import React, { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Avatar } from '@/components/ui';
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '@/theme';
import { useAuth } from '@/hooks/use-auth';
import { useThoughts, useThoughtsStats } from '@/hooks/use-thoughts';
import { useAppLock } from '@/hooks/use-app-lock';
import { useCurrentMood, useThemeColors } from '@/hooks/use-mood-theme';
import {
  FadeSlideView,
  TactileCardButton,
} from '@/features/home/components/AnimatedMotionPrimitives';
import { EmotionMeterCard } from '@/features/home/components/EmotionMeterCard';
import { WeeklyRecapCard } from '@/features/home/components/WeeklyRecapCard';
import { getSafeBottomPadding } from '@/utils/safe-area';

const HERO_JOURNAL_IMG = require('../../../assets/images/dashboard/hero-journal.jpg');
const MORNING_RITUAL_IMG = require('../../../assets/images/dashboard/morning-ritual.jpg');
const EVENING_RITUAL_IMG = require('../../../assets/images/dashboard/evening-ritual.jpg');
const PAUSE_BOTANICAL_IMG = require('../../../assets/images/dashboard/pause-botanical.jpg');

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTimeGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const RITUAL_CARDS = [
  {
    id: 'morning',
    title: 'Morning Pages',
    subtitle: 'What intention will ground you today?',
    mood: 'calm',
    prompt: 'Morning intention: ',
    image: MORNING_RITUAL_IMG,
    imageBg: '#E9F0EB',
  },
  {
    id: 'pause',
    title: 'Pause & Notice',
    subtitle: 'Name one small joy before it passes.',
    mood: 'grateful',
    prompt: 'I am grateful for ',
    image: PAUSE_BOTANICAL_IMG,
    imageBg: '#F4EFE6',
  },
  {
    id: 'evening',
    title: 'Evening Unwind',
    subtitle: 'Leave heavy thoughts softly on paper.',
    mood: 'calm',
    prompt: 'Evening reflection: ',
    image: EVENING_RITUAL_IMG,
    imageBg: '#EAEDF3',
  },
];

function SectionTitle({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={s.sectionHeader}>
      <AppText style={s.sectionTitle}>{title}</AppText>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} hitSlop={8} activeOpacity={0.7}>
          <AppText
            variant="label"
            color={colors.primaryDark}
            style={{ fontFamily: FontFamily.semiBold }}
          >
            {actionLabel}
          </AppText>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function HomeTab() {
  const colors = useThemeColors();
  const currentMood = useCurrentMood();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { days, fetchDays } = useThoughts();
  const { stats, fetchStats } = useThoughtsStats();
  const { reminders } = useAppLock();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchDays(true);
      fetchStats(true);
    }, [fetchDays, fetchStats])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchDays(false), fetchStats(true)]);
    setRefreshing(false);
  };

  const isTablet = width >= 600;
  const isSmallPhone = width < 370;
  const hPad = isTablet ? Spacing[8] : isSmallPhone ? Spacing[4] : Spacing[5];
  const maxW = isTablet ? 660 : undefined;
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const today = new Date();
  const todayStr = toLocalDateStr(today);
  const todaySummary = days.find((d) => d.day_date === todayStr);

  const currentHour = today.getHours();
  const timeGreeting = getTimeGreeting(currentHour);
  const showMorningReminder =
    reminders.morningEnabled && currentHour < 12 && !todaySummary;
  const showEveningReminder =
    reminders.eveningEnabled && currentHour >= 18 && !todaySummary;

  const ritualCardWidth = isSmallPhone ? 168 : isTablet ? 200 : 182;

  const openTodayWithPrompt = (prompt?: string, mood?: string) => {
    const params: Record<string, string> = {};
    if (prompt) params.prompt = prompt;
    if (mood) params.mood = mood;
    router.push({ pathname: `/thoughts/${todayStr}` as any, params });
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={[
          s.scroll,
          { paddingHorizontal: hPad },
          maxW ? { maxWidth: maxW, alignSelf: 'center' as const, width: '100%' } : null,
        ]}
      >
        {/* ── 1. Clean Readable Greeting (wraps smoothly, no badge under it) ── */}
        <FadeSlideView delay={0} distance={10}>
          <View style={s.masthead}>
            <View style={s.mastheadLeft}>
              <AppText variant="caption" color={Colors.textMuted} style={s.dateEyebrow}>
                {today
                  .toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })
                  .toUpperCase()}
              </AppText>
              <AppText
                style={[
                  s.greetName,
                  isSmallPhone && { fontSize: 25, lineHeight: 31 },
                  isTablet && { fontSize: 32, lineHeight: 38 },
                ]}
              >
                {timeGreeting}, {firstName}
              </AppText>
            </View>

            <TactileCardButton
              onPress={() => router.push('/(tabs)/profile' as any)}
              scaleTo={0.92}
              style={{ marginTop: 2 }}
            >
              <Avatar
                initials={user?.name?.slice(0, 2) ?? 'U'}
                uri={user?.avatar}
                size={isSmallPhone ? 'md' : 'lg'}
              />
            </TactileCardButton>
          </View>
        </FadeSlideView>

        {/* ── Reminder Strip (when enabled & no entry yet today) ── */}
        {(showMorningReminder || showEveningReminder) && (
          <FadeSlideView delay={40}>
            <TactileCardButton
              onPress={() =>
                openTodayWithPrompt(
                  showMorningReminder ? 'Morning intention: ' : 'Evening check-in: '
                )
              }
              contentStyle={[
                s.reminderStrip,
                { backgroundColor: colors.primaryLight, borderColor: colors.primaryBorder },
              ]}
            >
              <View style={[s.reminderIconWrap, { backgroundColor: colors.surface }]}>
                <Ionicons
                  name={showMorningReminder ? 'sunny' : 'moon'}
                  size={15}
                  color={colors.primaryDark}
                />
              </View>
              <AppText variant="label" color={colors.primaryText} style={{ flex: 1 }}>
                {showMorningReminder
                  ? 'Morning reminder: set a calm intention for today'
                  : 'Evening reminder: unwind & reflect on how today felt'}
              </AppText>
              <Ionicons name="arrow-forward" size={15} color={colors.primaryDark} />
            </TactileCardButton>
          </FadeSlideView>
        )}

        {/* ── 2. Illustrated Today Card (Clean, no desk badge, no archive button) ── */}
        <FadeSlideView delay={60}>
          <TactileCardButton
            onPress={() => router.push(`/thoughts/${todayStr}` as any)}
            style={s.heroOuter}
            contentStyle={s.heroCard}
          >
            <View style={s.heroLeftCol}>
              <AppText
                style={[
                  s.heroHeading,
                  isSmallPhone && { fontSize: 20, lineHeight: 26 },
                ]}
              >
                {todaySummary
                  ? `${todaySummary.thought_count} ${
                      todaySummary.thought_count === 1 ? 'thought' : 'thoughts'
                    } today`
                  : 'Quiet space for your thoughts'}
              </AppText>

              <AppText variant="body" color={Colors.textSecondary} style={s.heroSubcopy}>
                {todaySummary
                  ? "Pick up right where you left off in today's journal."
                  : 'Write freely, capture voice notes, or check in with your mood.'}
              </AppText>

              <View style={[s.heroPrimaryBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="create-outline" size={15} color={colors.textOnPrimary} />
                <AppText
                  variant="caption"
                  color={colors.textOnPrimary}
                  style={s.heroPrimaryBtnText}
                >
                  {todaySummary ? 'Continue writing' : 'Write today'}
                </AppText>
                <Feather name="arrow-right" size={13} color={colors.textOnPrimary} />
              </View>
            </View>

            <View style={[s.heroArtFrame, isSmallPhone && { width: 96, height: 116 }]}>
              <Image
                source={HERO_JOURNAL_IMG}
                style={s.heroArtImg}
                contentFit="cover"
                transition={250}
              />
            </View>
          </TactileCardButton>
        </FadeSlideView>

        {/* ── 3. Animated Emotion Meter ── */}
        <FadeSlideView delay={120} style={s.sectionGap}>
          <EmotionMeterCard
            moodCounts={stats?.moodCounts ?? []}
            latestMood={currentMood ?? stats?.latestMood ?? null}
            isSmallPhone={isSmallPhone}
            onSelectMood={(moodKey) => openTodayWithPrompt(undefined, moodKey)}
          />
        </FadeSlideView>

        {/* ── 4. Illustrated Journal Rituals ── */}
        <FadeSlideView delay={180} style={s.sectionGap}>
          <SectionTitle
            title="Daily Rituals"
            actionLabel="All days"
            onAction={() => router.push('/(tabs)/thoughts' as any)}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -hPad }}
            contentContainerStyle={[s.hRow, { paddingHorizontal: hPad }]}
          >
            {RITUAL_CARDS.map((card) => (
              <TactileCardButton
                key={card.id}
                onPress={() => openTodayWithPrompt(card.prompt, card.mood)}
                contentStyle={[s.ritualCard, { width: ritualCardWidth }]}
              >
                <View style={[s.ritualImageBox, { backgroundColor: card.imageBg }]}>
                  <Image
                    source={card.image}
                    style={s.ritualImage}
                    contentFit="cover"
                    transition={220}
                  />
                </View>

                <View style={s.ritualBody}>
                  <AppText style={s.ritualTitle} numberOfLines={1}>
                    {card.title}
                  </AppText>
                  <AppText style={s.ritualHandwriting} numberOfLines={2}>
                    &ldquo;{card.subtitle}&rdquo;
                  </AppText>
                </View>
              </TactileCardButton>
            ))}

            {/* Blank Stream Card */}
            <TactileCardButton
              onPress={() => router.push(`/thoughts/${todayStr}` as any)}
              contentStyle={[
                s.blankRitualCard,
                {
                  width: isSmallPhone ? 136 : 148,
                  backgroundColor: colors.primarySoft,
                  borderColor: colors.primaryBorder,
                },
              ]}
            >
              <View style={[s.blankPlusCircle, { backgroundColor: colors.primary }]}>
                <Feather name="plus" size={20} color={colors.textOnPrimary} />
              </View>
              <AppText variant="label" color={colors.primaryText} style={{ fontFamily: FontFamily.semiBold }}>
                Blank Page
              </AppText>
              <AppText variant="caption" color={Colors.textSecondary} align="center">
                Write freely without a prompt
              </AppText>
            </TactileCardButton>
          </ScrollView>
        </FadeSlideView>

        {/* ── 5. Minimal Readable Weekly Recap ── */}
        <FadeSlideView delay={240} style={s.sectionGap}>
          <WeeklyRecapCard
            stats={stats}
            days={days}
            isSmallPhone={isSmallPhone}
            onOpenDay={(dayDate) => router.push(`/thoughts/${dayDate}` as any)}
            onOpenTopPerson={(personId) => router.push(`/people/${personId}` as any)}
            onOpenTopTag={(tag) =>
              router.push({ pathname: '/(tabs)/thoughts' as any, params: { tag } })
            }
          />
        </FadeSlideView>

        {/* Space for floating tab bar */}
        <View style={{ height: getSafeBottomPadding(insets.bottom, 108, 136, 124) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingTop: Spacing[4], flexGrow: 1 },

  masthead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing[3],
    marginBottom: Spacing[5],
  },
  mastheadLeft: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  dateEyebrow: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 0.9,
  },
  greetName: {
    fontFamily: FontFamily.editorial,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: Colors.text,
  },

  reminderStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    marginBottom: Spacing[4],
  },
  reminderIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroOuter: {
    marginBottom: Spacing[5],
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: '#ECEAE4',
    gap: Spacing[3],
    ...Shadow.sm,
  },
  heroLeftCol: {
    flex: 1,
    minWidth: 0,
    gap: Spacing[2],
    alignItems: 'flex-start',
  },
  heroHeading: {
    fontFamily: FontFamily.editorialSemi,
    fontSize: 22,
    lineHeight: 28,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  heroSubcopy: {
    fontSize: FontSize.sm,
    lineHeight: 19,
  },
  heroPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    marginTop: 2,
  },
  heroPrimaryBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
  },
  heroArtFrame: {
    width: 112,
    height: 128,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: '#F5F3EE',
    borderWidth: 1,
    borderColor: '#ECEAE4',
    flexShrink: 0,
  },
  heroArtImg: {
    width: '100%',
    height: '100%',
  },

  sectionGap: {
    marginBottom: Spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  sectionTitle: {
    fontFamily: FontFamily.editorialSemi,
    fontSize: 20,
    lineHeight: 25,
    color: Colors.text,
    letterSpacing: -0.3,
  },

  hRow: {
    flexDirection: 'row',
    gap: Spacing[3],
    paddingBottom: Spacing[1],
  },
  ritualCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: '#ECEAE4',
    overflow: 'hidden',
    ...Shadow.xs,
  },
  ritualImageBox: {
    width: '100%',
    height: 112,
  },
  ritualImage: {
    width: '100%',
    height: '100%',
  },
  ritualBody: {
    padding: Spacing[3],
    gap: 4,
    minHeight: 84,
  },
  ritualTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  ritualHandwriting: {
    fontFamily: FontFamily.handwriting,
    fontSize: 14,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  blankRitualCard: {
    minHeight: 196,
    borderRadius: Radius['2xl'],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: Spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
  },
  blankPlusCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[1],
  },
});
