import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  useWindowDimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize, Shadow } from '@/theme';
import { usePeople, type SavePersonInput } from '@/hooks/use-people';
import type { Person } from '@/services/people.service';
import { AddEditPersonModal } from '../components/AddEditPersonModal';
import { getSafeBottomPadding } from '@/utils/safe-area';

const TABLET = 600;

function formatLastMentionDate(isoStr?: string | null): string {
  if (!isoStr) return 'No mentions yet';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return 'No mentions yet';

  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Mentioned today • ${time}`;

  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Last mentioned ${date}`;
}

export default function PeopleListScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET;
  const isSmallPhone = width < 370;
  const maxW = isTablet ? 600 : undefined;

  const { people, loading, fetchPeople, addPerson } = usePeople();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchPeople(true);
    }, [fetchPeople])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPeople(false);
    setRefreshing(false);
  };

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q)
    );
  }, [people, search]);

  const handleCreatePerson = async (payload: SavePersonInput) => {
    await addPerson(payload);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
        ]}
      >
        <View style={styles.headerTextCol}>
          <AppText style={[styles.mainTitle, isTablet && { fontSize: 36, lineHeight: 42 }]}>
            People
          </AppText>
          <AppText variant="caption" color={Colors.textSecondary}>
            Mention anyone with @ in your thoughts
          </AppText>
        </View>

        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.85}
          style={styles.addHeaderBtn}
        >
          <Ionicons name="add" size={18} color={Colors.white} />
          <AppText variant="label" style={styles.addHeaderBtnText}>
            Add
          </AppText>
        </TouchableOpacity>
      </View>

      {/* ── Search Pill (shown when people exist) ── */}
      {people.length > 0 && (
        <View
          style={[
            styles.searchWrap,
            maxW ? { maxWidth: maxW, alignSelf: 'center', width: '100%' } : null,
          ]}
        >
          <View style={styles.searchPill}>
            <Ionicons name="search-outline" size={17} color={Colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search people or @handle..."
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Main Content ── */}
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
        {loading && people.length === 0 ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : filteredPeople.length > 0 ? (
          <View style={styles.listCol}>
            <View style={styles.sectionHeaderRow}>
              <AppText variant="label" color={Colors.textMuted} style={styles.sectionLabel}>
                {filteredPeople.length} {filteredPeople.length === 1 ? 'PERSON' : 'PEOPLE'}
              </AppText>
              <View style={styles.sectionLine} />
            </View>

            {filteredPeople.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                isSmallPhone={isSmallPhone}
              />
            ))}
          </View>
        ) : people.length > 0 ? (
          <View style={styles.emptySearchState}>
            <Ionicons name="search" size={32} color={Colors.textMuted} />
            <AppText variant="title" style={{ color: '#241B14' }}>
              No matching people
            </AppText>
            <AppText variant="caption" color={Colors.textSecondary} align="center">
              Try a different name or add &ldquo;{search.trim()}&rdquo; as a new person.
            </AppText>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="people" size={40} color={Colors.primary} />
            </View>
            <AppText style={styles.emptyTitle}>No people added yet</AppText>
            <AppText
              variant="body"
              color={Colors.textSecondary}
              align="center"
              style={styles.emptySubtext}
            >
              Add people in your life so you can mention them with @ in chat and revisit everything you wrote about them.
            </AppText>
            <Button
              label="Add Person"
              variant="primary"
              size="md"
              fullWidth={false}
              onPress={() => setShowAddModal(true)}
              leftIcon={<Ionicons name="person-add-outline" size={18} color={Colors.white} />}
              style={styles.emptyCtaBtn}
            />
          </View>
        )}

        {/* Space for floating tab bar */}
        <View style={{ height: getSafeBottomPadding(insets.bottom, 108, 136, 124) }} />
      </ScrollView>

      <AddEditPersonModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleCreatePerson}
      />
    </SafeAreaView>
  );
}

function PersonCard({
  person,
  isSmallPhone,
}: {
  person: Person;
  isSmallPhone: boolean;
}) {
  const mentionCount = person.mention_count ?? 0;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => router.push(`/people/${person.id}` as any)}
      style={styles.card3D}
    >
      <View style={styles.cardInner}>
        {/* Left: Profile Picture or Solid Profile Icon Badge */}
        {person.avatar_url ? (
          <Image
            source={{ uri: person.avatar_url }}
            style={[styles.avatarBadge, isSmallPhone && styles.avatarBadgeSmall]}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.solidProfileBadge, isSmallPhone && styles.avatarBadgeSmall]}>
            <Ionicons
              name="person"
              size={isSmallPhone ? 22 : 26}
              color={Colors.white}
            />
          </View>
        )}

        {/* Right: Name, @handle, Mention Count */}
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View style={styles.nameCol}>
              <AppText
                variant="title"
                numberOfLines={1}
                style={[styles.personName, isSmallPhone && { fontSize: FontSize.md }]}
              >
                {person.name}
              </AppText>
              <AppText variant="caption" color={Colors.textMuted} numberOfLines={1}>
                @{person.handle}
              </AppText>
            </View>

            {/* Mention Count Pill */}
            <View
              style={[
                styles.mentionCountBadge,
                mentionCount > 0 && styles.mentionCountBadgeActive,
              ]}
            >
              <AppText
                variant="caption"
                style={[
                  styles.mentionCountNum,
                  mentionCount > 0 && styles.mentionCountNumActive,
                ]}
              >
                {mentionCount}
              </AppText>
              <AppText
                variant="caption"
                style={[
                  styles.mentionCountLabel,
                  mentionCount > 0 && styles.mentionCountLabelActive,
                ]}
              >
                {mentionCount === 1 ? 'mention' : 'mentions'}
              </AppText>
            </View>
          </View>

          <View style={styles.cardBottomRow}>
            <AppText variant="caption" color={Colors.textSecondary} numberOfLines={1} style={styles.lastMentionText}>
              {formatLastMentionDate(person.last_mentioned_at)}
            </AppText>
            <Feather name="chevron-right" size={15} color={Colors.textMuted} />
          </View>
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
    gap: Spacing[3],
  },
  headerTextCol: {
    flex: 1,
    gap: 2,
  },
  mainTitle: {
    fontFamily: FontFamily.editorial,
    fontSize: 29,
    lineHeight: 35,
    color: '#241B14',
    letterSpacing: -0.7,
  },
  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing[4],
    paddingVertical: 9,
    borderRadius: Radius.full,
    ...Shadow.sm,
  },
  addHeaderBtnText: {
    fontFamily: FontFamily.bold,
    color: Colors.white,
    fontSize: FontSize.sm,
  },
  searchWrap: {
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[3],
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: '#ECEAE4',
    paddingHorizontal: Spacing[4],
    height: 44,
    gap: Spacing[2],
    ...Shadow.xs,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.text,
    height: '100%',
  },
  scrollContent: {
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[1],
    gap: Spacing[3],
    flexGrow: 1,
  },
  loadingState: {
    paddingVertical: Spacing[12],
    alignItems: 'center',
  },
  listCol: {
    gap: Spacing[3],
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

  // ── Similar 3D Tactile Card as ThoughtsListScreen ──
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
    alignItems: 'center',
  },
  avatarBadge: {
    width: 62,
    height: 62,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceAlt,
  },
  solidProfileBadge: {
    width: 62,
    height: 62,
    borderRadius: Radius.lg,
    backgroundColor: '#26221D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeSmall: {
    width: 52,
    height: 52,
  },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing[2],
  },
  nameCol: {
    flex: 1,
    gap: 1,
  },
  personName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    lineHeight: 22,
    color: '#241B14',
  },
  mentionCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F1EC',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mentionCountBadgeActive: {
    backgroundColor: Colors.primaryLight,
  },
  mentionCountNum: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  mentionCountNumActive: {
    color: Colors.primaryDark,
  },
  mentionCountLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textMuted,
  },
  mentionCountLabelActive: {
    color: Colors.primaryText,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[2],
  },
  lastMentionText: {
    flex: 1,
    fontSize: 12,
  },

  // ── Empty States ──
  emptySearchState: {
    paddingVertical: Spacing[10],
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
  },
  emptyContainer: {
    paddingVertical: Spacing[10],
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
  },
  emptyIconCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[1],
  },
  emptyTitle: {
    fontFamily: FontFamily.editorial,
    fontSize: 21,
    color: '#241B14',
    textAlign: 'center',
  },
  emptySubtext: {
    width: '100%',
    maxWidth: 300,
    lineHeight: 21,
    fontSize: FontSize.sm,
  },
  emptyCtaBtn: {
    marginTop: Spacing[2],
    paddingHorizontal: Spacing[6],
  },
});
