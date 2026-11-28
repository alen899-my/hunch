import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, Divider, Input } from '@/components/ui';
import { Colors, Spacing, FontSize } from '@/theme';
import { useThemeColors } from '@/hooks/use-mood-theme';
import { useAuth } from '@/hooks/use-auth';
import { getSafeBottomPadding } from '@/utils/safe-area';

const TABLET = 600;

export default function LoginScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET;

  const params = useLocalSearchParams<{ email?: string; registered?: string }>();
  const { login, loading, error, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // If already logged in, redirect directly to home
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  // Pre-fill email and show message if coming from successful registration
  useEffect(() => {
    if (params.email) {
      setEmail(params.email);
    }
  }, [params.email]);

  const handleLogin = async () => {
    if (!email || !password) return;
    const res = await login({ email, password });
    if (res.success) {
      router.replace('/(tabs)');
    }
  };

  const safeBottom = getSafeBottomPadding(insets.bottom, Spacing[8], 60, 44);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            isTablet && styles.scrollTablet,
            { paddingBottom: safeBottom },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Card container — centred on tablet */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>

            {/* Back */}
            <TouchableOpacity onPress={() => router.back()} style={styles.back}>
              <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
              <AppText variant="label" color={Colors.textSecondary}>Back</AppText>
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <AppText
                variant="h2"
                style={{ fontSize: isTablet ? FontSize['3xl'] : FontSize['2xl'] }}
              >
                Welcome back
              </AppText>
              <AppText variant="body" color={Colors.textSecondary}>
                Sign in to continue your journey
              </AppText>
            </View>

            {/* Success notification if just registered */}
            {params.registered === '1' && (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
                <AppText variant="caption" color="#2E7D32" style={styles.successText}>
                  Account created successfully! Please sign in with your password.
                </AppText>
              </View>
            )}

            {/* Form */}
            <View style={styles.form}>
              <Input
                label="Email or Phone"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.textMuted} />}
              />
              <Input
                label="Password"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} hitSlop={8}>
                    <Ionicons
                      name={showPass ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={Colors.textSecondary}
                    />
                  </TouchableOpacity>
                }
              />

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
                  <AppText variant="caption" color={Colors.error} style={styles.errorText}>
                    {error}
                  </AppText>
                </View>
              ) : null}

              <TouchableOpacity style={styles.forgotRow}>
                <AppText variant="label" color={colors.primary}>Forgot password?</AppText>
              </TouchableOpacity>

              <Button
                label="Sign In"
                onPress={handleLogin}
                loading={loading}
                size="lg"
              />

              <Divider label="or continue with" />

              <Button
                label="Continue with Google"
                variant="secondary"
                size="lg"
                onPress={() =>
                  Alert.alert(
                    'Google Sign-In',
                    'Add your Google OAuth Client ID in server/.env to enable one-tap Google sign-in, or sign in with your email above.'
                  )
                }
                leftIcon={<AntDesign name="google" size={18} color="#4285F4" />}
              />
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <AppText variant="body" color={Colors.textSecondary}>
                Don't have an account?{' '}
              </AppText>
              <TouchableOpacity onPress={() => router.push('/signup')}>
                <AppText variant="bodyMd" color={colors.primary}>Sign up</AppText>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: Colors.background },
  flex:  { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[4],
  },
  scrollTablet: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing[8],
  },
  card: { width: '100%' },
  cardTablet: {
    maxWidth: 480,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing[8],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  back:   { flexDirection: 'row', alignItems: 'center', gap: Spacing[1], marginBottom: Spacing[4] },
  header: { gap: Spacing[2], marginBottom: Spacing[5] },
  form:   { gap: Spacing[4] },
  forgotRow: { alignSelf: 'flex-end' },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing[3],
    marginBottom: Spacing[4],
  },
  successText: {
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
    backgroundColor: Colors.errorLight,
    borderRadius: 10,
    padding: Spacing[3],
  },
  errorText: { flex: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: Spacing[8],
    paddingBottom: Spacing[2],
  },
});
