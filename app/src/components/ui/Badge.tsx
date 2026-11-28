import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/theme';
import { useThemeColors } from '@/hooks/use-mood-theme';
import { AppText } from './AppText';

type BadgeColor = 'amber' | 'pink' | 'purple' | 'green' | 'blue' | 'default';

interface BadgeProps {
  label: string;
  color?: BadgeColor;
  style?: ViewStyle;
  dot?: boolean;
}

const colorMap: Record<BadgeColor, { bg: string; text: string }> = {
  amber:   { bg: Colors.tagAmber,   text: Colors.tagAmberText },
  pink:    { bg: Colors.tagPink,    text: Colors.tagPinkText },
  purple:  { bg: Colors.tagPurple,  text: Colors.tagPurpleText },
  green:   { bg: Colors.tagGreen,   text: Colors.tagGreenText },
  blue:    { bg: Colors.tagBlue,    text: Colors.tagBlueText },
  default: { bg: Colors.surfaceAlt, text: Colors.textSecondary },
};

export function Badge({ label, color = 'default', style, dot }: BadgeProps) {
  const colors = useThemeColors();
  const { bg, text } =
    color === 'green'
      ? { bg: colors.tagGreen, text: colors.tagGreenText }
      : colorMap[color];
  return (
    <View style={[styles.base, { backgroundColor: bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: text }]} />}
      <AppText variant="caption" color={text} style={styles.text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing[3],
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontWeight: '600' },
});
