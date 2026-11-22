import React from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Shadow, Size } from '@/theme';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
}

const variantConfig: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary:   { bg: Colors.primary,   text: Colors.textOnPrimary },
  secondary: { bg: Colors.surface,   text: Colors.text,          border: Colors.border },
  outline:   { bg: Colors.transparent, text: Colors.primary,     border: Colors.primary },
  ghost:     { bg: Colors.transparent, text: Colors.text },
  danger:    { bg: Colors.error,     text: Colors.white },
};

const sizeConfig: Record<ButtonSize, { height: number; px: number; fontSize: number }> = {
  sm: { height: Size.buttonHeightSm, px: 16, fontSize: FontSize.sm },
  md: { height: Size.buttonHeightMd, px: 20, fontSize: FontSize.md },
  lg: { height: Size.buttonHeightLg, px: 24, fontSize: FontSize.lg },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = true,
  leftIcon,
  rightIcon,
  style,
}: ButtonProps) {
  const vc = variantConfig[variant];
  const sc = sizeConfig[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={isDisabled}
      style={[
        styles.base,
        {
          backgroundColor: vc.bg,
          height: sc.height,
          paddingHorizontal: sc.px,
          borderColor: vc.border ?? Colors.transparent,
          borderWidth: vc.border ? 1.5 : 0,
        },
        variant === 'primary' && Shadow.sm,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={vc.text} size="small" />
      ) : (
        <View style={styles.row}>
          {leftIcon}
          <AppText
            variant="bodyMd"
            color={vc.text}
            style={{ fontSize: sc.fontSize, fontFamily: FontFamily.semiBold }}
          >
            {label}
          </AppText>
          {rightIcon}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
