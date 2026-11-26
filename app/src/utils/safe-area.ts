import { Platform } from 'react-native';

/**
 * Computes comfortable bottom padding that clears the mobile navigation bar
 * (Android 3-button / gesture bar and iOS home indicator), even inside Modals
 * or edge-to-edge layouts where system bars can overlap bottom controls.
 */
export function getSafeBottomPadding(
  insetBottom: number,
  extra = 24,
  androidMin = 56,
  iosMin = 44
): number {
  if (Platform.OS === 'web') return extra;
  const minFloor = Platform.OS === 'ios' ? iosMin : androidMin;
  return Math.max(insetBottom + extra, minFloor);
}

/**
 * Computes safe top padding for fullscreen modals (camera, photo/video lightboxes)
 * so close and flash controls stay below the status bar and display cutout.
 */
export function getSafeTopPadding(
  insetTop: number,
  extra = 12,
  androidMin = 36,
  iosMin = 54
): number {
  if (Platform.OS === 'web') return extra;
  const minFloor = Platform.OS === 'ios' ? iosMin : androidMin;
  return Math.max(insetTop + extra, minFloor);
}
