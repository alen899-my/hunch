import React, { useState } from 'react';
import {
  TextInput,
  View,
  TouchableOpacity,
  StyleSheet,
  TextStyle,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Shadow, Size, Spacing } from '@/theme';
import { useThemeColors } from '@/hooks/use-mood-theme';
import { AppText } from './AppText';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  inputStyle?: TextStyle;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  style,
  inputStyle,
  ...rest
}: InputProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? Colors.error
    : focused
    ? colors.borderFocus
    : Colors.border;

  return (
    <View style={[styles.wrapper, style]}>
      {label && (
        <AppText variant="label" color={Colors.textSecondary} style={styles.label}>
          {label}
        </AppText>
      )}

      <View style={[styles.container, { borderColor }]}>
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

        <TextInput
          {...rest}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          placeholderTextColor={Colors.textMuted}
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeft : null,
            rightIcon ? styles.inputWithRight : null,
            inputStyle,
          ]}
        />

        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>

      {error && (
        <AppText variant="caption" color={Colors.error} style={styles.hint}>
          {error}
        </AppText>
      )}
      {hint && !error && (
        <AppText variant="caption" color={Colors.textMuted} style={styles.hint}>
          {hint}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { marginLeft: 2 },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    height: Size.inputHeight,
    paddingHorizontal: Spacing[4],
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.text,
    height: '100%',
  },
  inputWithLeft:  { paddingLeft: 8 },
  inputWithRight: { paddingRight: 8 },
  iconLeft:  { marginRight: 4, flexShrink: 0 },
  iconRight: { marginLeft: 4, flexShrink: 0 },
  hint: { marginLeft: 2, marginTop: 2 },
});
