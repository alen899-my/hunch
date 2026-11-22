import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import {
  CameraView,
  CameraType,
  CameraMode,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize, Shadow } from '@/theme';

export interface CameraResult {
  uri: string;
  type: 'photo' | 'video';
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
}

interface CustomCameraProps {
  visible: boolean;
  mode?: 'photo' | 'video' | 'both';
  onCapture: (result: CameraResult) => void;
  onClose: () => void;
}

export function CustomCameraModal({ visible, mode = 'both', onCapture, onClose }: CustomCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [captureMode, setCaptureMode] = useState<CameraMode>(
    mode === 'video' ? 'video' : 'picture'
  );
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shutterScale = useRef(new Animated.Value(1)).current;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setIsRecording(false);
      setRecordingTime(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [visible]);

  const animateShutter = () => {
    Animated.sequence([
      Animated.timing(shutterScale, { toValue: 0.86, duration: 80, useNativeDriver: true }),
      Animated.spring(shutterScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current || isTakingPhoto) return;
    animateShutter();
    setIsTakingPhoto(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        exif: false,
      });
      if (photo) {
        onCapture({
          uri: photo.uri,
          type: 'photo',
          mimeType: 'image/jpeg',
          width: photo.width,
          height: photo.height,
        });
        onClose();
      }
    } catch {
      Alert.alert('Could not capture photo', 'Please try again.');
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const handleStartRecording = async () => {
    if (!cameraRef.current || isRecording) return;
    if (!micPermission?.granted) {
      const res = await requestMicPermission();
      if (!res.granted) {
        Alert.alert('Microphone needed', 'Microphone permission is required to record video with audio.');
        return;
      }
    }
    animateShutter();
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 120 });
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      setRecordingTime(0);
      if (video) {
        const { width: winW, height: winH } = Dimensions.get('window');
        onCapture({
          uri: video.uri,
          type: 'video',
          mimeType: 'video/mp4',
          width: Math.round(winW),
          height: Math.round(winH),
          duration: recordingTime,
        });
        onClose();
      }
    } catch {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  const handleStopRecording = () => {
    cameraRef.current?.stopRecording();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleCapture = () => {
    if (captureMode === 'picture') {
      handleTakePhoto();
    } else {
      if (isRecording) handleStopRecording();
      else handleStartRecording();
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!visible) return null;

  if (!permission?.granted) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.permissionOverlay}>
          <View style={styles.permissionCard}>
            <Ionicons name="camera-outline" size={48} color={Colors.textSecondary} />
            <AppText style={styles.permissionTitle}>Camera Access Needed</AppText>
            <AppText variant="body" color={Colors.textSecondary} align="center" style={{ marginBottom: Spacing[4] }}>
              Grant camera permission to take photos and record videos.
            </AppText>
            <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn} activeOpacity={0.88}>
              <AppText style={styles.permissionBtnText}>Grant Permission</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={{ marginTop: Spacing[3] }}>
              <AppText variant="caption" color={Colors.textSecondary}>Not now</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.cameraContainer}>
        {/* CameraView WITHOUT children to avoid native SDK crash / warning */}
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          mode={captureMode}
        />

        {/* Controls Overlay using absolute positioning on top of CameraView */}
        <View style={styles.overlayContainer} pointerEvents="box-none">
          {/* Top Controls */}
          <View style={styles.cameraTopBar}>
            <TouchableOpacity onPress={onClose} style={styles.camIconBtn} hitSlop={8}>
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.cameraTopCenter}>
              {isRecording && (
                <View style={styles.recBadge}>
                  <View style={styles.recDot} />
                  <AppText style={styles.recTime}>{formatDuration(recordingTime)}</AppText>
                </View>
              )}
            </View>

            {/* Flash toggle */}
            <TouchableOpacity
              onPress={() => setFlash(f => f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off')}
              style={styles.camIconBtn}
              hitSlop={8}
            >
              <Ionicons
                name={flash === 'on' ? 'flash' : flash === 'auto' ? 'flash-outline' : 'flash-off'}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          {/* Bottom Controls */}
          <View style={styles.cameraBottomBar}>
            {/* Mode Switcher (only when mode==='both') */}
            {mode === 'both' && (
              <View style={styles.modeSwitcher}>
                <TouchableOpacity
                  onPress={() => setCaptureMode('picture')}
                  style={[styles.modeTab, captureMode === 'picture' && styles.modeTabActive]}
                >
                  <AppText style={[styles.modeTabText, captureMode === 'picture' && styles.modeTabTextActive]}>Photo</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setCaptureMode('video')}
                  style={[styles.modeTab, captureMode === 'video' && styles.modeTabActive]}
                >
                  <AppText style={[styles.modeTabText, captureMode === 'video' && styles.modeTabTextActive]}>Video</AppText>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.captureRow}>
              {/* Flip Camera */}
              <TouchableOpacity
                onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
                style={styles.sideBtn}
                hitSlop={12}
              >
                <Ionicons name="camera-reverse-outline" size={28} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Shutter */}
              <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
                <TouchableOpacity
                  onPress={handleCapture}
                  activeOpacity={0.85}
                  disabled={isTakingPhoto}
                  style={[
                    styles.shutterBtn,
                    captureMode === 'video' && (isRecording ? styles.shutterBtnRecording : styles.shutterBtnVideo),
                  ]}
                >
                  {isTakingPhoto ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : captureMode === 'video' && isRecording ? (
                    <View style={styles.stopSquare} />
                  ) : (
                    <View style={styles.shutterInner} />
                  )}
                </TouchableOpacity>
              </Animated.View>

              {/* Spacer */}
              <View style={styles.sideBtn} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  permissionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[6],
  },
  permissionCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius['2xl'],
    padding: Spacing[6],
    alignItems: 'center',
    width: '100%',
    gap: Spacing[2],
    ...Shadow.lg,
  },
  permissionTitle: {
    fontFamily: FontFamily.editorial,
    fontSize: FontSize.xl,
    color: '#241B14',
    textAlign: 'center',
    marginTop: Spacing[2],
  },
  permissionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius['2xl'],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[8],
    width: '100%',
    alignItems: 'center',
  },
  permissionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: '#FFFFFF',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },
  cameraTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing[4],
    paddingTop: Platform.OS === 'ios' ? 54 : Spacing[4],
  },
  cameraTopCenter: {
    flex: 1,
    alignItems: 'center',
  },
  camIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    gap: 6,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E05252',
  },
  recTime: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
  },
  cameraBottomBar: {
    paddingBottom: Platform.OS === 'ios' ? 42 : Spacing[6],
    paddingHorizontal: Spacing[6],
    gap: Spacing[4],
    alignItems: 'center',
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: Radius.full,
    padding: 3,
  },
  modeTab: {
    paddingHorizontal: Spacing[5],
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
  },
  modeTabText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.75)',
  },
  modeTabTextActive: {
    color: '#1A1A1A',
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  sideBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtnVideo: {
    borderColor: '#E05252',
    backgroundColor: 'rgba(224,82,82,0.15)',
  },
  shutterBtnRecording: {
    backgroundColor: '#E05252',
    borderColor: '#E05252',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
  },
  stopSquare: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});
