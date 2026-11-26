import React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize, Shadow } from '@/theme';
import type { Person } from '@/services/people.service';

interface MentionSuggestionsBoxProps {
  people: Person[];
  query: string;
  onSelectPerson: (person: Person) => void;
  onQuickAddPerson?: (suggestedName: string) => void;
}

export function MentionSuggestionsBox({
  people,
  query,
  onSelectPerson,
  onQuickAddPerson,
}: MentionSuggestionsBoxProps) {
  const trimmedQuery = query.trim();
  const canQuickAdd = Boolean(
    onQuickAddPerson &&
      (people.length === 0 || (trimmedQuery.length > 0 && !trimmedQuery.includes(' ')))
  );

  if (people.length === 0 && !canQuickAdd) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="at" size={14} color={Colors.primaryDark} />
          <AppText variant="caption" style={styles.headerTitle}>
            {people.length > 0 ? 'Mention person' : 'No matching people'}
          </AppText>
        </View>
        {onQuickAddPerson && (
          <TouchableOpacity
            onPress={() => onQuickAddPerson(trimmedQuery)}
            hitSlop={8}
            activeOpacity={0.75}
            style={styles.quickAddPill}
          >
            <Ionicons name="person-add-outline" size={12} color={Colors.primaryDark} />
            <AppText variant="caption" style={styles.quickAddText}>
              {trimmedQuery && people.length === 0 ? `Add "${trimmedQuery}"` : 'Add person'}
            </AppText>
          </TouchableOpacity>
        )}
      </View>

      {people.length > 0 ? (
        <ScrollView
          style={styles.listScroll}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {people.map((person, index) => (
            <TouchableOpacity
              key={person.id}
              onPress={() => onSelectPerson(person)}
              activeOpacity={0.75}
              style={[
                styles.row,
                index < people.length - 1 && styles.rowBorder,
              ]}
            >
              {person.avatar_url ? (
                <Image
                  source={{ uri: person.avatar_url }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name="person" size={16} color={Colors.white} />
                </View>
              )}

              <View style={styles.personMeta}>
                <AppText variant="bodyMd" numberOfLines={1} style={styles.personName}>
                  {person.name}
                </AppText>
                <AppText variant="caption" color={Colors.textMuted} numberOfLines={1}>
                  @{person.handle}
                </AppText>
              </View>

              <View style={styles.countPill}>
                <AppText variant="caption" style={styles.countText}>
                  {person.mention_count}
                </AppText>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyHintRow}>
          <AppText variant="caption" color={Colors.textSecondary}>
            Tap &ldquo;{trimmedQuery ? `Add "${trimmedQuery}"` : 'Add person'}&rdquo; to create someone and mention them here.
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing[4],
    marginBottom: Spacing[2],
    borderRadius: Radius['2xl'],
    borderWidth: 1.5,
    borderColor: '#ECEAE4',
    overflow: 'hidden',
    ...Shadow.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    backgroundColor: '#FAF7F1',
    borderBottomWidth: 1,
    borderBottomColor: '#EFECE6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerTitle: {
    fontFamily: FontFamily.semiBold,
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
  },
  quickAddPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  quickAddText: {
    fontFamily: FontFamily.bold,
    color: Colors.primaryDark,
    fontSize: 11,
  },
  listScroll: {
    maxHeight: 190,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: 10,
    gap: Spacing[3],
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EFECE6',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: '#26221D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personMeta: {
    flex: 1,
    gap: 1,
  },
  personName: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    lineHeight: 18,
    color: Colors.text,
  },
  countPill: {
    minWidth: 24,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F3F1EC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  countText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  emptyHintRow: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
  },
});
