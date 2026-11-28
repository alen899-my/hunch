import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { Colors, Spacing, Radius, FontFamily, FontSize, Shadow } from '@/theme';
import { useThemeColors } from '@/hooks/use-mood-theme';
import { getSafeBottomPadding } from '@/utils/safe-area';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatShortDateLabel(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

function parseYearMonth(dateStr?: string | null): { year: number; month: number } {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m] = dateStr.split('-').map(Number);
    return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export interface DatePickerModalProps {
  visible: boolean;
  selectedDate: string | null;
  activeDates?: Set<string>;
  title?: string;
  subtitle?: string;
  allowClear?: boolean;
  onSelectDate: (dateStr: string) => void;
  onClear?: () => void;
  onClose: () => void;
}

/**
 * Editorial warm-stone bottom sheet calendar date picker matching Hunch theme.
 */
export function DatePickerModal({
  visible,
  selectedDate,
  activeDates,
  title = 'Filter by Date',
  subtitle = 'Pick a day to view recorded thoughts',
  allowClear = true,
  onSelectDate,
  onClear,
  onClose,
}: DatePickerModalProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 370;
  const isCompactHeight = height < 700;
  const safeBottom = getSafeBottomPadding(insets.bottom, 22, 54, 38);

  const initialYM = parseYearMonth(selectedDate);
  const [viewYear, setViewYear] = useState(initialYM.year);
  const [viewMonth, setViewMonth] = useState(initialYM.month);

  useEffect(() => {
    if (visible) {
      const nextYM = parseYearMonth(selectedDate);
      setViewYear(nextYM.year);
      setViewMonth(nextYM.month);
    }
  }, [visible, selectedDate]);

  const todayDate = new Date();
  const todayStr = toLocalDateString(todayDate);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(todayDate.getDate() - 1);
  const yesterdayStr = toLocalDateString(yesterdayDate);

  const calendarCells = useMemo(() => {
    const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: { key: string; day: number | null; dateStr: string | null }[] = [];

    for (let i = 0; i < firstDayWeekday; i++) {
      cells.push({ key: `pad-start-${i}`, day: null, dateStr: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(
        2,
        '0'
      )}`;
      cells.push({ key: dateStr, day, dateStr });
    }
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        cells.push({ key: `pad-end-${i}`, day: null, dateStr: null });
      }
    }
    return cells;
  }, [viewYear, viewMonth]);

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handlePick = (dateStr: string) => {
    onSelectDate(dateStr);
    onClose();
  };

  const handleClear = () => {
    onClear?.();
    onClose();
  };

  const cellHeight = isCompactHeight ? 38 : isSmallPhone ? 40 : 44;
  const circleSize = isCompactHeight ? 32 : isSmallPhone ? 34 : 36;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            isSmallPhone && { paddingHorizontal: Spacing[4] },
            { paddingBottom: safeBottom },
          ]}
        >
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <AppText style={[styles.sheetTitle, isSmallPhone && { fontSize: FontSize.lg }]} numberOfLines={1}>
                {title}
              </AppText>
              <AppText variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                {subtitle}
              </AppText>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollBody}
          >
            {/* Quick Presets */}
            <View style={styles.quickRow}>
              <TouchableOpacity
                onPress={() => handlePick(todayStr)}
                activeOpacity={0.8}
                style={[
                  styles.quickChip,
                  { backgroundColor: colors.primaryLight, borderColor: colors.primaryBorder },
                  selectedDate === todayStr && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Ionicons
                  name="today-outline"
                  size={13}
                  color={selectedDate === todayStr ? Colors.white : colors.primaryDark}
                />
                <AppText
                  variant="caption"
                  style={[
                    styles.quickChipText,
                    { color: colors.primaryDark },
                    selectedDate === todayStr && styles.quickChipTextActive,
                  ]}
                >
                  Today
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handlePick(yesterdayStr)}
                activeOpacity={0.8}
                style={[
                  styles.quickChip,
                  { backgroundColor: colors.primaryLight, borderColor: colors.primaryBorder },
                  selectedDate === yesterdayStr && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  style={[
                    styles.quickChipText,
                    { color: colors.primaryDark },
                    selectedDate === yesterdayStr && styles.quickChipTextActive,
                  ]}
                >
                  Yesterday
                </AppText>
              </TouchableOpacity>

              {allowClear && selectedDate && onClear && (
                <TouchableOpacity
                  onPress={handleClear}
                  activeOpacity={0.8}
                  style={styles.clearChip}
                >
                  <Ionicons name="close-circle-outline" size={13} color={Colors.textSecondary} />
                  <AppText variant="caption" style={styles.clearChipText}>
                    All Dates
                  </AppText>
                </TouchableOpacity>
              )}
            </View>

            {/* Calendar Card */}
            <View style={styles.calendarCard}>
              {/* Month Switcher */}
              <View style={styles.monthHeader}>
                <TouchableOpacity
                  onPress={goToPrevMonth}
                  style={styles.monthArrowBtn}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={18} color={Colors.text} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setViewYear(todayDate.getFullYear());
                    setViewMonth(todayDate.getMonth());
                  }}
                  activeOpacity={0.7}
                >
                  <AppText style={[styles.monthLabel, isSmallPhone && { fontSize: FontSize.md }]}>
                    {MONTHS[viewMonth]} {viewYear}
                  </AppText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={goToNextMonth}
                  style={styles.monthArrowBtn}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-forward" size={18} color={Colors.text} />
                </TouchableOpacity>
              </View>

              {/* Weekday Headers */}
              <View style={styles.weekdaysRow}>
                {WEEKDAYS.map((wd) => (
                  <View key={wd} style={styles.weekdayCell}>
                    <AppText
                      variant="caption"
                      style={[styles.weekdayText, isSmallPhone && { fontSize: 9 }]}
                    >
                      {isSmallPhone ? wd.slice(0, 2) : wd}
                    </AppText>
                  </View>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.daysGrid}>
                {calendarCells.map((cell) => {
                  if (!cell.day || !cell.dateStr) {
                    return <View key={cell.key} style={[styles.dayCell, { height: cellHeight }]} />;
                  }

                  const isSelected = selectedDate === cell.dateStr;
                  const isToday = todayStr === cell.dateStr;
                  const hasEntry = Boolean(activeDates?.has(cell.dateStr));

                  return (
                    <TouchableOpacity
                      key={cell.key}
                      onPress={() => handlePick(cell.dateStr!)}
                      activeOpacity={0.75}
                      style={[styles.dayCell, { height: cellHeight }]}
                    >
                      <View
                        style={[
                          styles.dayCircle,
                          { width: circleSize, height: circleSize, borderRadius: circleSize / 2 },
                          isToday &&
                            !isSelected && {
                              backgroundColor: colors.primaryLight,
                              borderWidth: 1.5,
                              borderColor: colors.primary,
                            },
                          isSelected && { backgroundColor: colors.primary },
                        ]}
                      >
                        <AppText
                          variant="caption"
                          style={[
                            styles.dayNum,
                            isSmallPhone && { fontSize: 12 },
                            isToday && !isSelected && [styles.dayNumToday, { color: colors.primaryDark }],
                            isSelected && styles.dayNumSelected,
                          ]}
                        >
                          {cell.day}
                        </AppText>
                      </View>
                      <View
                        style={[
                          styles.entryDot,
                          hasEntry
                            ? { backgroundColor: isSelected ? colors.primaryDark : colors.primary }
                            : { backgroundColor: 'transparent' },
                        ]}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Subtle Legend */}
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <AppText variant="caption" color={Colors.textMuted} style={{ fontSize: 11 }}>
                Colored dot indicates days with saved thoughts
              </AppText>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(26, 22, 18, 0.48)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[3],
    maxHeight: '90%',
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing[3],
    ...Shadow.lg,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DCD8CE',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[2],
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sheetTitle: {
    fontFamily: FontFamily.editorial,
    fontSize: FontSize.xl,
    color: '#241B14',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    flexShrink: 0,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    gap: Spacing[3],
    paddingBottom: Spacing[1],
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing[2],
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  quickChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  quickChipText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: Colors.primaryDark,
  },
  quickChipTextActive: {
    color: Colors.white,
    fontFamily: FontFamily.bold,
  },
  clearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F1EC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    marginLeft: 'auto' as any,
  },
  clearChipText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  calendarCard: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.xl,
    padding: Spacing[3],
    borderWidth: 1,
    borderColor: '#ECEAE4',
    gap: Spacing[2],
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[1],
    paddingBottom: Spacing[1],
  },
  monthArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontFamily: FontFamily.editorial,
    fontSize: FontSize.lg,
    color: '#241B14',
  },
  weekdaysRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAE6DD',
  },
  weekdayCell: {
    width: '14.2857%',
    alignItems: 'center',
  },
  weekdayText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 4,
  },
  dayCell: {
    width: '14.2857%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  dayCircleSelected: {
    backgroundColor: Colors.primary,
  },
  dayNum: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: Colors.text,
  },
  dayNumToday: {
    fontFamily: FontFamily.bold,
    color: Colors.primaryDark,
  },
  dayNumSelected: {
    fontFamily: FontFamily.bold,
    color: Colors.white,
  },
  entryDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 2,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
});
