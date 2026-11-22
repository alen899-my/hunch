import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/theme';

// Height of the floating tab bar + its bottom margin — screens must pad this
const FLOATING_TAB_H = 80;

interface ScreenProps {
  children?: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  bg?: string;
  padded?: boolean;
  keyboardAvoiding?: boolean;
  /** Set true for screens inside the tab navigator so content clears the floating bar */
  tabScreen?: boolean;
}

export function Screen({
  children,
  scroll = false,
  style,
  contentStyle,
  bg = Colors.background,
  padded = true,
  keyboardAvoiding = false,
  tabScreen = false,
}: ScreenProps) {
  const insets    = useSafeAreaInsets();
  const extraPad  = tabScreen ? FLOATING_TAB_H + insets.bottom : 0;

  const inner = scroll ? (
    <KeyboardAvoidingView
      style={styles.flex}
      enabled={keyboardAvoiding}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          padded && styles.padded,
          extraPad ? { paddingBottom: extraPad } : null,
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        bounces={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  ) : (
    <View
      style={[
        styles.inner,
        padded && styles.padded,
        extraPad ? { paddingBottom: extraPad } : null,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }, style]}>
      <StatusBar barStyle="dark-content" />
      {inner}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1 },
  flex:          { flex: 1 },
  inner:         { flex: 1 },
  scrollContent: { flexGrow: 1 },
  padded:        { paddingHorizontal: Spacing[5] },
});
