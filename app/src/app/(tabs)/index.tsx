import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Avatar, Badge, Card } from '@/components/ui';
import { Colors, Spacing, Radius, Shadow, FontFamily } from '@/theme';
import { useAuth } from '@/hooks/use-auth';

// ── Helpers ─────────────────────────────────────────────────
const DAYS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const today  = new Date();
const todayN = today.getDate();

function getDayStrip() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(todayN - 3 + i);
    return { num: d.getDate(), day: DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1] };
  });
}

const MOODS = [
  { label: 'Happy',   pct: 48, color: Colors.emotionHappy },
  { label: 'Sad',     pct: 33, color: Colors.emotionSad   },
  { label: 'Calm',    pct: 27, color: Colors.emotionCalm  },
  { label: 'Anxious', pct: 40, color: Colors.emotionAnxious },
];

const QUICK_CARDS = [
  { id: '1', title: 'Pause & reflect', prompt: 'What are you grateful for today?', tag: 'Personal', tagColor: 'pink' as const },
  { id: '2', title: 'Set Intentions',  prompt: 'How do you want to feel?',          tag: 'Family',  tagColor: 'purple' as const },
  { id: '3', title: 'Evening check',   prompt: 'What made you smile today?',        tag: 'Self',    tagColor: 'green' as const },
];

// ── Sub-components ───────────────────────────────────────────
function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={s.sectionHeader}>
      <AppText variant="h4">{title}</AppText>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <AppText variant="label" color={Colors.primary}>See all</AppText>
        </TouchableOpacity>
      )}
    </View>
  );
}

function DateStrip({ cols }: { cols: number }) {
  const days = getDayStrip();
  const sliced = cols >= 7 ? days : days.slice(0, cols);
  return (
    <View style={s.dateRow}>
      {sliced.map(({ num, day }) => {
        const isToday = num === todayN;
        return (
          <View key={num} style={[s.dateCell, isToday && s.dateCellActive]}>
            <AppText
              variant="caption"
              color={isToday ? Colors.textOnPrimary : Colors.textMuted}
              style={{ fontFamily: FontFamily.medium }}
            >
              {day}
            </AppText>
            <AppText
              variant="bodyMd"
              color={isToday ? Colors.textOnPrimary : Colors.text}
            >
              {num}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

function MoodBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View style={s.moodCol}>
      <View style={s.moodTrack}>
        <View style={[s.moodFill, { height: `${pct}%` as any, backgroundColor: color }]} />
        <AppText variant="caption" color={Colors.white} style={s.moodPct}>{pct}%</AppText>
      </View>
      <AppText variant="caption" color={Colors.textSecondary} align="center">{label}</AppText>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────
export default function HomeTab() {
  const { width }    = useWindowDimensions();
  const { user }     = useAuth();
  const isTablet     = width >= 600;
  const hPad         = isTablet ? Spacing[8] : Spacing[5];
  const cols         = isTablet ? 7 : 7;
  const maxW         = isTablet ? 640 : undefined;
  const firstName    = user?.name?.split(' ')[0] ?? 'there';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.scroll,
          { paddingHorizontal: hPad },
          maxW ? { maxWidth: maxW, alignSelf: 'center' as const, width: '100%' } : null,
        ]}
      >
        {/* ── Greeting ─────────────────────────── */}
        <View style={s.greeting}>
          <View style={s.greetLeft}>
            <AppText variant="h2" style={s.greetName}>Hi, {firstName}</AppText>
            <AppText variant="body" color={Colors.textSecondary}>
              {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </AppText>
          </View>
          <Avatar initials={user?.name?.slice(0,2) ?? 'U'} uri={user?.avatar} size="lg" />
        </View>

        {/* ── Date strip ───────────────────────── */}
        <DateStrip cols={cols} />

        {/* ── Daily Thoughts Stream Feature Banner ── */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push(`/thoughts/${today.toISOString().split('T')[0]}` as any)}
          style={s.thoughtStreamCard}
        >
          <View style={s.thoughtStreamLeft}>
            <View style={s.thoughtStreamBadge}>
              <Ionicons name="chatbubbles" size={14} color={Colors.white} />
              <AppText variant="caption" color={Colors.white} style={{ fontFamily: FontFamily.bold, fontSize: 10 }}>
                DAILY THOUGHTS
              </AppText>
            </View>
            <AppText variant="title" style={{ color: Colors.text }}>
              Dump thinking & overthinking
            </AppText>
            <AppText variant="caption" color={Colors.textSecondary}>
              Tap to open today's chat stream
            </AppText>
          </View>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              router.push('/thoughts' as any);
            }}
            style={s.viewAllDaysBtn}
          >
            <Ionicons name="calendar-outline" size={18} color={Colors.primaryDark} />
            <AppText variant="caption" color={Colors.primaryDark} style={{ fontFamily: FontFamily.bold }}>
              All Days
            </AppText>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* ── My Journal ───────────────────────── */}
        <SectionHeader title="My Journal" onSeeAll={() => router.push('/thoughts' as any)} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hScroll}>
          <View style={s.hRow}>
            {/* Morning card */}
            <TouchableOpacity 
              activeOpacity={0.85}
              onPress={() => router.push(`/thoughts/${today.toISOString().split('T')[0]}` as any)}
            >
              <Card bg={Colors.primaryLight} shadow="xs" style={s.journalCard}>
                <Ionicons name="sunny-outline" size={28} color={Colors.primary} />
                <AppText variant="title" color={Colors.primaryText}>Let's start{'\n'}your day</AppText>
                <AppText variant="caption" color={Colors.textSecondary}>
                  Begin with a mindful morning reflection.
                </AppText>
              </Card>
            </TouchableOpacity>

            {/* Evening card */}
            <TouchableOpacity 
              activeOpacity={0.85}
              onPress={() => router.push(`/thoughts/${today.toISOString().split('T')[0]}` as any)}
            >
              <Card bg={Colors.surfaceAlt} shadow="xs" style={s.journalCard}>
                <Ionicons name="moon-outline" size={28} color={Colors.textSecondary} />
                <AppText variant="title">Evening</AppText>
                <AppText variant="caption" color={Colors.textSecondary}>
                  How did today feel?
                </AppText>
              </Card>
            </TouchableOpacity>

            {/* Add card */}
            <TouchableOpacity 
              style={[s.journalCard, s.addCard]}
              onPress={() => router.push(`/thoughts/${today.toISOString().split('T')[0]}` as any)}
            >
              <Ionicons name="add-circle-outline" size={32} color={Colors.primary} />
              <AppText variant="label" color={Colors.primary}>New entry</AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* ── Emotions ─────────────────────────── */}
        <Card style={s.moodCard} shadow="xs">
          <SectionHeader title="Emotions" />
          <AppText variant="caption" color={Colors.textMuted}>
            Here are your four core emotions
          </AppText>
          <View style={s.moodRow}>
            {MOODS.map((m) => <MoodBar key={m.label} {...m} />)}
          </View>
        </Card>

        {/* ── Quick Journal ────────────────────── */}
        <SectionHeader title="Quick Journal" onSeeAll={() => {}} />
        <FlatList
          data={QUICK_CARDS}
          keyExtractor={(i) => i.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ width: Spacing[3] }} />}
          contentContainerStyle={{ paddingRight: hPad }}
          renderItem={({ item }) => (
            <Card style={s.quickCard} shadow="sm">
              <AppText variant="title" numberOfLines={1}>{item.title}</AppText>
              <AppText variant="caption" color={Colors.textSecondary} style={{ marginTop: 4 }}>
                {item.prompt}
              </AppText>
              <View style={s.quickFooter}>
                <AppText variant="caption" color={Colors.textMuted}>Today</AppText>
                <Badge label={item.tag} color={item.tagColor} />
              </View>
            </Card>
          )}
        />

        {/* Space for floating tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const CARD_W = 160;

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingTop: Spacing[5], flexGrow: 1 },

  // Greeting
  greeting:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing[5] },
  greetLeft: { flex: 1, gap: 2 },
  greetName: { letterSpacing: -0.5 },

  // Date strip
  dateRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing[6] },
  dateCell:      { flex: 1, alignItems: 'center', paddingVertical: Spacing[2], borderRadius: Radius.full, gap: 2 },
  dateCellActive:{ backgroundColor: Colors.primary },

  // Section header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing[3] },

  // Journal h-scroll
  hScroll:     { marginHorizontal: -Spacing[5] },
  hRow:        { flexDirection: 'row', gap: Spacing[3], paddingHorizontal: Spacing[5] },
  journalCard: { width: CARD_W, minHeight: 160, gap: Spacing[2], marginBottom: Spacing[5] },
  addCard:     {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[5],
  },

  // Mood
  moodCard:  { marginBottom: Spacing[6], gap: Spacing[3] },
  moodRow:   { flexDirection: 'row', justifyContent: 'space-between', height: 160, alignItems: 'flex-end' },
  moodCol:   { flex: 1, alignItems: 'center', gap: Spacing[2] },
  moodTrack: {
    flex: 1,
    width: 44,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius['3xl'],
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  moodFill:  { borderRadius: Radius['3xl'], width: '100%', minHeight: 24 },
  moodPct:   { textAlign: 'center', paddingBottom: 4 },

  // Quick cards
  quickCard:   { width: CARD_W, minHeight: 120, gap: Spacing[2] },
  quickFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing[2] },

  // Thought stream feature banner
  thoughtStreamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: Spacing[4],
    borderRadius: Radius['2xl'],
    borderWidth: 1.5,
    borderColor: '#ECEAE4',
    marginBottom: Spacing[6],
    gap: Spacing[3],
    ...Shadow.sm,
  },
  thoughtStreamLeft: {
    flex: 1,
    gap: 4,
  },
  thoughtStreamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    gap: 4,
    marginBottom: 2,
  },
  viewAllDaysBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.xl,
    gap: 2,
  },
});
