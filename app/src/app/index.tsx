import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { useThemeColors } from '@/hooks/use-mood-theme';

export default function Index() {
  const { isInitialized, isAuthenticated } = useAuth();
  const colors = useThemeColors();

  useEffect(() => {
    if (!isInitialized) return;

    if (isAuthenticated) {
      router.replace('/(tabs)');
    } else {
      router.replace('/get-started');
    }
  }, [isInitialized, isAuthenticated]);

  return (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
