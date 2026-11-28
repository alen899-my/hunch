import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize, Shadow } from '@/theme';
import { useThemeColors } from '@/hooks/use-mood-theme';
import type { TagSummary } from '@/services/thoughts.service';

interface TagSuggestionsBoxProps {
  tags: TagSummary[];
  query: string;
  onSelectTag: (tag: string) => void;
}

export function TagSuggestionsBox({
  tags,
  query,
  onSelectTag,
}: TagSuggestionsBoxProps) {
  const colors = useThemeColors();
  const cleanQuery = query.trim().toLowerCase();
  const filtered = cleanQuery
    ? tags.filter((t) => t.tag.toLowerCase().includes(cleanQuery))
    : tags;

  const exactMatch = tags.some((t) => t.tag.toLowerCase() === cleanQuery);
  const canCreateNew = cleanQuery.length > 0 && !exactMatch;

  if (filtered.length === 0 && !canCreateNew) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { backgroundColor: colors.primarySoft }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="pricetag-outline" size={13} color={Colors.tagPurpleText} />
          <AppText variant="caption" style={styles.headerTitle}>
            {filtered.length > 0 ? 'Topics & Tags' : 'New topic tag'}
          </AppText>
        </View>
      </View>

      <ScrollView
        style={styles.listScroll}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        {canCreateNew && (
          <TouchableOpacity
            onPress={() => onSelectTag(cleanQuery)}
            activeOpacity={0.75}
            style={[styles.row, filtered.length > 0 && styles.rowBorder]}
          >
            <View style={[styles.tagIconBadge, { backgroundColor: Colors.tagPurple }]}>
              <AppText variant="label" style={{ color: Colors.tagPurpleText }}>
                #
              </AppText>
            </View>
            <AppText variant="bodyMd" style={styles.tagName}>
              Create #{cleanQuery}
            </AppText>
          </TouchableOpacity>
        )}

        {filtered.map((item, idx) => (
          <TouchableOpacity
            key={item.tag}
            onPress={() => onSelectTag(item.tag)}
            activeOpacity={0.75}
            style={[styles.row, idx < filtered.length - 1 && styles.rowBorder]}
          >
            <View style={styles.tagIconBadge}>
              <AppText variant="label" style={{ color: Colors.white }}>
                #
              </AppText>
            </View>
            <AppText variant="bodyMd" style={styles.tagName}>
              #{item.tag}
            </AppText>
            <View style={styles.countPill}>
              <AppText variant="caption" style={styles.countText}>
                {item.count}
              </AppText>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
    backgroundColor: Colors.primarySoft,
    borderBottomWidth: 1,
    borderBottomColor: '#EFECE6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontFamily: FontFamily.semiBold,
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
  },
  listScroll: {
    maxHeight: 170,
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
  tagIconBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    backgroundColor: '#26221D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagName: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
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
});
