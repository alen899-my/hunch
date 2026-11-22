import React, { useState } from 'react';
import {
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { AppText } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize, Shadow } from '@/theme';

export interface PendingMedia {
  uri: string;
  type: 'image' | 'video';
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
}

interface MediaPreviewModalProps {
  visible: boolean;
  media: PendingMedia | null;
  onClose: () => void;
  onSend: (media: PendingMedia, caption: string) => void;
}

// ── Inline Video Preview with dynamic content height ──────────────────────────
function VideoPreview({ uri, height }: { uri: string; height: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <View style={[styles.videoWrapper, { height }]}>
      <VideoView
        style={styles.videoPlayer}
        player={player}
        nativeControls={false}
        contentFit="cover"
      />
    </View>
  );
}

export function MediaPreviewModal({
  visible,
  media,
  onClose,
  onSend,
}: MediaPreviewModalProps) {
  const [caption, setCaption] = useState('');

  if (!visible || !media) return null;

  const handleSend = () => {
    const finalCaption = caption.trim();
    setCaption('');
    onSend(media, finalCaption);
  };

  const handleClose = () => {
    setCaption('');
    onClose();
  };

  const isVideo = media.type === 'video';

  // Calculate dynamic preview card height based on actual content dimensions
  const screenW = Dimensions.get('window').width;
  const cardW = Math.min(screenW - 40, 480);
  const rawAspect = media.width && media.height && media.width > 0 ? media.height / media.width : 0.65;
  // Natural dynamic height clamped between 150 (landscape) and 280 (portrait)
  const mediaHeight = Math.round(Math.min(Math.max(cardW * rawAspect, 150), 280));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
        pointerEvents="box-none"
      >
        <View style={styles.sheetContainer}>
          {/* Top drag handle bar */}
          <View style={styles.handleBar} />

          {/* Header Row (Identical to Audio Preview Header) */}
          <View style={styles.headerRow}>
            <View>
              <AppText style={styles.sheetTitle}>
                {isVideo ? 'Preview Video' : 'Preview Photo'}
              </AppText>
              <AppText variant="caption" color={Colors.textSecondary}>
                {isVideo ? 'Review video before sending' : 'Review photo before sending'}
              </AppText>
            </View>

            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Preview Card (Adjusts height dynamically to content aspect ratio) */}
          <View style={[styles.mediaCard, { height: mediaHeight }]}>
            {isVideo ? (
              <VideoPreview uri={media.uri} height={mediaHeight} />
            ) : (
              <Image
                source={{ uri: media.uri }}
                style={styles.imagePreview}
                contentFit="cover"
                transition={150}
              />
            )}
          </View>

          {/* WhatsApp-Style Caption Input Pill */}
          <View style={styles.captionInputPill}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={18}
              color={Colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a caption..."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={600}
              style={styles.captionInput}
            />
          </View>

          {/* Action Row: Discard & Send (Identical to Audio preview design) */}
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={handleClose} style={styles.discardBtn} activeOpacity={0.8}>
              <AppText style={styles.discardText}>Discard</AppText>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSend}
              style={styles.sendConfirmBtn}
              activeOpacity={0.88}
            >
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <AppText style={styles.sendConfirmText}>Send</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing[3],
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing[5],
    paddingHorizontal: Spacing[5],
    gap: Spacing[3],
    ...Shadow.md,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DCD8CE',
    alignSelf: 'center',
    marginBottom: Spacing[1],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontFamily: FontFamily.editorial,
    fontSize: FontSize.lg,
    color: '#241B14',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCard: {
    width: '100%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  videoWrapper: {
    width: '100%',
    position: 'relative',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  videoBadgeText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
  },
  captionInputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[3],
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    minHeight: 44,
  },
  captionInput: {
    flex: 1,
    color: Colors.text,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    maxHeight: 70,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginTop: Spacing[1],
  },
  discardBtn: {
    flex: 1,
    paddingVertical: Spacing[3],
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardText: {
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  sendConfirmBtn: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: Spacing[3],
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendConfirmText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSize.sm,
  },
});
