import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  TouchableOpacity,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

interface FadeSlideViewProps {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Restrained page-settling entrance animation for dashboard sections.
 */
export function FadeSlideView({
  children,
  delay = 0,
  distance = 14,
  style,
}: FadeSlideViewProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 460,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

interface TactileCardButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  activeOpacity?: number;
  disabled?: boolean;
  scaleTo?: number;
}

/**
 * Tactile spring-pressed card wrapper with light selection haptics.
 */
export function TactileCardButton({
  children,
  onPress,
  style,
  contentStyle,
  activeOpacity = 0.94,
  disabled = false,
  scaleTo = 0.975,
}: TactileCardButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: scaleTo,
      friction: 8,
      tension: 260,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 7,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    try {
      Haptics.selectionAsync().catch(() => {});
    } catch {
      // ignore haptics unavailable on web
    }
    onPress?.();
  };

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={activeOpacity}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={contentStyle}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Quiet breathing status dot for live stream/theme indicators.
 */
export function LivePulseDot({ color, size = 8 }: { color: string; size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const haloScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });
  const haloOpacity = pulse.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.55, 0.35, 0],
  });

  return (
    <View style={[dotStyles.wrap, { width: size * 2.2, height: size * 2.2 }]}>
      <Animated.View
        style={[
          dotStyles.halo,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          },
        ]}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

const dotStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
});
