import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, View } from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/theme';
import { AppText } from './AppText';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export function Chip({ label, selected = false, onPress, style, icon }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.base,
        {
          backgroundColor: selected ? Colors.primary : Colors.surface,
          borderColor: selected ? Colors.primary : Colors.border,
        },
        style,
      ]}
    >
      {icon && <View>{icon}</View>}
      <AppText
        variant="label"
        color={selected ? Colors.textOnPrimary : Colors.textSecondary}
        style={{ fontFamily: selected ? FontFamily.semiBold : FontFamily.regular }}
      >
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
});
