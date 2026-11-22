import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Size } from '@/theme';
import { AppText } from './AppText';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  uri?: string;
  initials?: string;
  size?: AvatarSize;
  style?: ViewStyle;
}

const sizeMap: Record<AvatarSize, number> = {
  sm: Size.avatarSm,
  md: Size.avatarMd,
  lg: Size.avatarLg,
  xl: Size.avatarXl,
};

const fontSizeMap: Record<AvatarSize, number> = { sm: 11, md: 14, lg: 20, xl: 28 };

export function Avatar({ uri, initials = '?', size = 'md', style }: AvatarProps) {
  const dim = sizeMap[size];
  return (
    <View
      style={[
        styles.base,
        { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: Colors.primaryLight },
        style,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: dim, height: dim, borderRadius: dim / 2 }} />
      ) : (
        <AppText variant="label" color={Colors.primaryText} style={{ fontSize: fontSizeMap[size] }}>
          {initials.slice(0, 2).toUpperCase()}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
