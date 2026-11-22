import React from 'react';
import { Text as RNText, TextStyle, StyleProp, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize } from '@/theme';

type Variant =
  | 'display'   // 44px bold — hero numbers
  | 'h1'        // 36px bold
  | 'h2'        // 30px bold
  | 'h3'        // 24px semibold
  | 'h4'        // 20px semibold
  | 'title'     // 17px semibold
  | 'body'      // 15px regular
  | 'bodyMd'    // 15px medium
  | 'label'     // 13px medium
  | 'caption'   // 11px regular
  | 'code';     // 13px mono

interface AppTextProps {
  variant?: Variant;
  color?: string;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
  numberOfLines?: number;
  onPress?: () => void;
}

const variantStyles: Record<Variant, TextStyle> = {
  display: { fontFamily: FontFamily.black,    fontSize: FontSize['5xl'], lineHeight: FontSize['5xl'] * 1.1 },
  h1:      { fontFamily: FontFamily.bold,     fontSize: FontSize['4xl'], lineHeight: FontSize['4xl'] * 1.15 },
  h2:      { fontFamily: FontFamily.bold,     fontSize: FontSize['3xl'], lineHeight: FontSize['3xl'] * 1.2 },
  h3:      { fontFamily: FontFamily.semiBold, fontSize: FontSize['2xl'], lineHeight: FontSize['2xl'] * 1.3 },
  h4:      { fontFamily: FontFamily.semiBold, fontSize: FontSize.xl,    lineHeight: FontSize.xl * 1.35 },
  title:   { fontFamily: FontFamily.semiBold, fontSize: FontSize.lg,    lineHeight: FontSize.lg * 1.4 },
  body:    { fontFamily: FontFamily.regular,  fontSize: FontSize.md,    lineHeight: FontSize.md * 1.6 },
  bodyMd:  { fontFamily: FontFamily.medium,   fontSize: FontSize.md,    lineHeight: FontSize.md * 1.6 },
  label:   { fontFamily: FontFamily.medium,   fontSize: FontSize.sm,    lineHeight: FontSize.sm * 1.4 },
  caption: { fontFamily: FontFamily.regular,  fontSize: FontSize.xs,    lineHeight: FontSize.xs * 1.4 },
  code:    { fontFamily: 'monospace',         fontSize: FontSize.sm,    lineHeight: FontSize.sm * 1.5 },
};

export function AppText({
  variant = 'body',
  color = Colors.text,
  align,
  style,
  children,
  numberOfLines,
  onPress,
}: AppTextProps) {
  return (
    <RNText
      onPress={onPress}
      numberOfLines={numberOfLines}
      style={[variantStyles[variant], { color }, align ? { textAlign: align } : null, style]}
    >
      {children}
    </RNText>
  );
}
