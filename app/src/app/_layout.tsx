import {
  useFonts,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_400Regular_Italic,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../hooks/use-auth';
import { AppLockProvider } from '../hooks/use-app-lock';
import { MoodThemeSync } from '../hooks/use-mood-theme';
import { useThoughtsStats } from '../hooks/use-thoughts';
import { AppLockOverlay } from '../features/profile/components/ProfileModals';

LogBox.ignoreLogs([
  'Method writeAsStringAsync imported from "expo-file-system" is deprecated',
]);

SplashScreen.preventAutoHideAsync();

function AuthenticatedMoodStatsSync() {
  useThoughtsStats();
  return null;
}

function MoodThemeCoordinator() {
  const { isAuthenticated } = useAuth();
  return (
    <>
      <MoodThemeSync />
      {isAuthenticated ? <AuthenticatedMoodStatsSync /> : null}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_400Regular_Italic,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppLockProvider>
        <AuthProvider>
          <MoodThemeCoordinator />
          <StatusBar barStyle="dark-content" />
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="get-started" />
            <Stack.Screen name="login" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="signup" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="thoughts/index" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="thoughts/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="people/[id]" options={{ animation: 'slide_from_right' }} />
          </Stack>
          <AppLockOverlay />
        </AuthProvider>
      </AppLockProvider>
    </SafeAreaProvider>
  );
}
