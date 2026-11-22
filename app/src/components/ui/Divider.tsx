import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing } from '@/theme';
import { AppText } from './AppText';

interface DividerProps {
  label?: string;
  style?: ViewStyle;
  color?: string;
}

export function Divider({ label, style, color = Colors.border }: DividerProps) {
  if (!label) {
    return <View style={[styles.line, { backgroundColor: color }, style]} />;
  }
  return (
    <View style={[styles.row, style]}>
      <View style={[styles.flex, { backgroundColor: color }]} />
      <AppText variant="caption" color={Colors.textMuted} style={styles.text}>
        {label}
      </AppText>
      <View style={[styles.flex, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: { height: 1, alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  flex: { flex: 1, height: 1 },
  text: { flexShrink: 0 },
});
