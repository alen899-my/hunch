import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, Button } from '@/components/ui';
import { Colors, Spacing, FontSize, FontFamily, Shadow } from '@/theme';
import { useAuth } from '@/hooks/use-auth';

const TABLET = 600;

export default function GetStartedScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET;
  const { isAuthenticated } = useAuth();

  // If already logged in, redirect directly to home
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  const contentMaxWidth = isTablet ? 460 : undefined;
  const horizontalPadding = isTablet ? Spacing[8] : Spacing[6];

  return (
    <View style={styles.container}>
      {/* Full-bleed Hero Image using direct relative path to asset */}
      <Image
        source={require('../../../../assets/images/start/getstart.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      {/* Smooth gradient: fully transparent across top half, darkening smoothly only behind bottom text */}
      <LinearGradient
        colors={[
          'transparent',
          'rgba(0, 0, 0, 0.15)',
          'rgba(0, 0, 0, 0.65)',
          'rgba(0, 0, 0, 0.88)',
        ]}
        locations={[0, 0.45, 0.72, 1]}
        style={styles.gradientOverlay}
      />

      {/* Content directly over the image */}
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View
          style={[
            styles.contentWrapper,
            { paddingHorizontal: horizontalPadding },
            contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : null,
          ]}
        >
          {/* Typography */}
          <View style={styles.textBlock}>
            <AppText variant="h1" style={styles.title}>
              Reflect. Feel.{'\n'}Grow.
            </AppText>
            <AppText variant="body" style={styles.subtitle}>
              Your personal space to journal emotions, celebrate small wins, and understand yourself better.
            </AppText>
          </View>

          {/* Action CTAs */}
          <View style={styles.actions}>
            <Button
              label="Get Started"
              onPress={() => router.push('/signup')}
              variant="primary"
              size="lg"
              style={styles.ctaButton}
            />

            <TouchableOpacity
              onPress={() => router.push('/login')}
              activeOpacity={0.7}
              style={styles.loginRow}
            >
              <AppText variant="body" style={styles.loginText}>
                Already have an account?{' '}
              </AppText>
              <AppText variant="bodyMd" style={styles.loginLink}>
                Sign In
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1917',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  safe: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  contentWrapper: {
    width: '100%',
    paddingBottom: Spacing[6],
    gap: Spacing[7],
  },
  textBlock: {
    gap: Spacing[3],
  },
  title: {
    color: '#FFFFFF',
    letterSpacing: -0.8,
    fontFamily: FontFamily.bold,
    fontSize: 38,
    lineHeight: 44,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.88)',
    lineHeight: 23,
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  actions: {
    gap: Spacing[4],
  },
  ctaButton: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 6,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing[1],
  },
  loginText: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  loginLink: {
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
});
