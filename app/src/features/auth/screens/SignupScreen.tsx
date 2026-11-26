import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, Divider, Input } from '@/components/ui';
import { Colors, Spacing, FontSize } from '@/theme';
import { useAuth } from '@/hooks/use-auth';
import { getSafeBottomPadding } from '@/utils/safe-area';

const TABLET = 600;

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET;

  const { register, loading, error, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [showPass, setShowPass] = useState(false);

  // If already logged in, redirect directly to home
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSignup = async () => {
    if (!form.name || !form.password || (!form.email && !form.phone)) return;
    const res = await register({
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      password: form.password,
    });

    // After signup, move directly to login as requested!
    if (res.success) {
      router.replace({
        pathname: '/login',
        params: { email: form.email || form.phone, registered: '1' },
      } as any);
    }
  };

  const safeBottom = getSafeBottomPadding(insets.bottom, Spacing[8], 60, 44);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
                Create account
              </AppText>
              <AppText variant="body" color={Colors.textSecondary}>
                Start your reflective journey today
              </AppText>
            </View>

            {/* Google first */}
            <Button
              label="Continue with Google"
              variant="secondary"
              size="lg"
              onPress={() => { /* Google flow */ }}
              leftIcon={<AntDesign name="google" size={18} color="#4285F4" />}
            />

            <Divider label="or sign up with email" />

            {/* Form */}
            <View style={styles.form}>
              <Input
                label="Full Name"
                placeholder="Jose Maria"
                value={form.name}
                onChangeText={set('name')}
                autoCapitalize="words"
                leftIcon={<Ionicons name="person-outline" size={18} color={Colors.textMuted} />}
              />
              <Input
                label="Email"
                placeholder="you@example.com"
                value={form.email}
                onChangeText={set('email')}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.textMuted} />}
              />
              <Input
                label="Phone (optional)"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChangeText={set('phone')}
                keyboardType="phone-pad"
                hint="Used for account recovery"
                leftIcon={<Ionicons name="call-outline" size={18} color={Colors.textMuted} />}
              />
              <Input
                label="Password"
                placeholder="At least 6 characters"
                value={form.password}
                onChangeText={set('password')}
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

              <Button
                label="Create Account"
                onPress={handleSignup}
                loading={loading}
                size="lg"
              />
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <AppText variant="body" color={Colors.textSecondary}>
                Already have an account?{' '}
              </AppText>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <AppText variant="bodyMd" color={Colors.primary}>Sign in</AppText>
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
  card: { width: '100%', gap: Spacing[4] },
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
    gap: Spacing[4],
  },
  back:   { flexDirection: 'row', alignItems: 'center', gap: Spacing[1] },
  header: { gap: Spacing[2] },
  form:   { gap: Spacing[4] },
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
    paddingBottom: Spacing[2],
  },
});
