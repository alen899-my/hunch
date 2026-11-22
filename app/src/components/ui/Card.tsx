import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { Colors, Radius, Shadow, Spacing } from '@/theme';

type ShadowLevel = keyof typeof Shadow;

interface CardProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  shadow?: ShadowLevel;
  radius?: number;
  padding?: number;
  bg?: string;
}

export function Card({
  children,
  style,
  shadow = 'sm',
  radius = Radius.xl,
  padding = Spacing[5],
  bg = Colors.surface,
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        Shadow[shadow],
        { borderRadius: radius, padding, backgroundColor: bg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
