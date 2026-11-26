import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, Input } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize, Shadow } from '@/theme';
import type { Person } from '@/services/people.service';
import type { SavePersonInput } from '@/hooks/use-people';
import { buildDefaultHandle } from '../utils/mentions';
import { getSafeBottomPadding } from '@/utils/safe-area';

interface PickedAvatar {
  uri: string;
  mimeType: string;
  isLocal: boolean;
}

interface AddEditPersonModalProps {
  visible: boolean;
  person?: Person | null;
  initialName?: string;
  onClose: () => void;
  onSave: (payload: SavePersonInput) => Promise<void>;
}

export function AddEditPersonModal({
  visible,
  person,
  initialName = '',
  onClose,
  onSave,
}: AddEditPersonModalProps) {
  const insets = useSafeAreaInsets();
  const isEditing = Boolean(person);

  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleTouched, setHandleTouched] = useState(false);
  const [avatar, setAvatar] = useState<PickedAvatar | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setSaving(false);
    setAvatarRemoved(false);

    if (person) {
      setName(person.name);
      setHandle(person.handle);
      setHandleTouched(true);
      setAvatar(
        person.avatar_url
          ? { uri: person.avatar_url, mimeType: 'image/jpeg', isLocal: false }
          : null
      );
    } else {
      const startName = initialName.trim();
      setName(startName);
      setHandle(startName ? buildDefaultHandle(startName) : '');
      setHandleTouched(false);
      setAvatar(null);
    }
  }, [visible, person, initialName]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!handleTouched && !isEditing) {
      setHandle(buildDefaultHandle(val));
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Gallery access needed', 'Please allow photo library access to set a profile picture.');
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (picked.canceled || !picked.assets?.length) return;

      const asset = picked.assets[0];
      setAvatar({
        uri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
        isLocal: true,
      });
      setAvatarRemoved(false);
    } catch (err: any) {
      Alert.alert('Could not select photo', err?.message || 'Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera access needed', 'Please allow camera access to take a profile photo.');
        return;
      }

      const taken = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (taken.canceled || !taken.assets?.length) return;

      const asset = taken.assets[0];
      setAvatar({
        uri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
        isLocal: true,
      });
      setAvatarRemoved(false);
    } catch (err: any) {
      Alert.alert('Camera error', err?.message || 'Could not take photo.');
    }
  };

  const handleRemovePhoto = () => {
    setAvatar(null);
    setAvatarRemoved(true);
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a name.');
      return;
    }

    const cleanHandle = buildDefaultHandle(handle || trimmedName) || 'person';

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: trimmedName,
        handle: cleanHandle,
        localAvatar: avatar?.isLocal ? { uri: avatar.uri, mimeType: avatar.mimeType } : null,
        avatarRemoved,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not save person. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  const safeBottom = getSafeBottomPadding(insets.bottom, 28, 60, 44);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
        pointerEvents="box-none"
      >
        <View style={[styles.sheetContainer, { paddingBottom: safeBottom }]}>
          <View style={styles.handleBar} />

          <View style={styles.headerRow}>
            <View>
              <AppText style={styles.sheetTitle}>
                {isEditing ? 'Edit Person' : 'Add Person'}
              </AppText>
              <AppText variant="caption" color={Colors.textSecondary}>
                {isEditing
                  ? 'Update profile details or picture'
                  : 'Mention them in any thought using @'}
              </AppText>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.formScroll}
          >
            {/* ── Profile Picture Picker ── */}
            <View style={styles.avatarSection}>
              <TouchableOpacity
                onPress={handlePickFromGallery}
                activeOpacity={0.85}
                style={styles.avatarPickerBox}
              >
                {avatar?.uri ? (
                  <Image
                    source={{ uri: avatar.uri }}
                    style={styles.avatarPreviewImg}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={34} color={Colors.white} />
                  </View>
                )}

                <View style={styles.cameraCornerBadge}>
                  <Ionicons name="camera" size={14} color={Colors.white} />
                </View>
              </TouchableOpacity>

              <View style={styles.photoActionsRow}>
                <TouchableOpacity
                  onPress={handlePickFromGallery}
                  style={styles.photoActionPill}
                  activeOpacity={0.75}
                >
                  <Ionicons name="images-outline" size={14} color={Colors.primaryDark} />
                  <AppText variant="caption" style={styles.photoActionText}>
                    Gallery
                  </AppText>
                </TouchableOpacity>

                {Platform.OS !== 'web' && (
                  <TouchableOpacity
                    onPress={handleTakePhoto}
                    style={styles.photoActionPill}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="camera-outline" size={14} color={Colors.primaryDark} />
                    <AppText variant="caption" style={styles.photoActionText}>
                      Camera
                    </AppText>
                  </TouchableOpacity>
                )}

                {avatar && (
                  <TouchableOpacity
                    onPress={handleRemovePhoto}
                    style={[styles.photoActionPill, styles.photoRemovePill]}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="trash-outline" size={14} color={Colors.error} />
                    <AppText variant="caption" style={[styles.photoActionText, { color: Colors.error }]}>
                      Remove
                    </AppText>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Name Input ── */}
            <Input
              label="Name"
              placeholder="e.g. Sarah, Mom, Alex Mercer"
              value={name}
              onChangeText={handleNameChange}
              autoCapitalize="words"
              maxLength={80}
              leftIcon={<Ionicons name="person-outline" size={18} color={Colors.textMuted} />}
            />

            {/* ── @Handle Input ── */}
            <Input
              label="@Mention tag"
              placeholder="sarah"
              value={handle}
              onChangeText={(val) => {
                setHandleTouched(true);
                setHandle(val.replace(/^@+/, ''));
              }}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={50}
              hint={`Type @${buildDefaultHandle(handle || name) || 'name'} in chat to mention`}
              leftIcon={<Ionicons name="at" size={18} color={Colors.textMuted} />}
            />

            {error && (
              <AppText variant="caption" color={Colors.error}>
                {error}
              </AppText>
            )}

            <View style={styles.actionsRow}>
              <Button
                label="Cancel"
                variant="secondary"
                size="md"
                fullWidth={false}
                onPress={onClose}
                style={styles.cancelBtn}
              />
              <Button
                label={isEditing ? 'Save Changes' : 'Add Person'}
                variant="primary"
                size="md"
                loading={saving}
                fullWidth={false}
                onPress={handleSubmit}
                style={styles.saveBtn}
              />
            </View>
          </ScrollView>
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
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingTop: Spacing[3],
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing[5],
    paddingHorizontal: Spacing[5],
    maxHeight: '88%',
    ...Shadow.lg,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DCD8CE',
    alignSelf: 'center',
    marginBottom: Spacing[3],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[4],
  },
  sheetTitle: {
    fontFamily: FontFamily.editorial,
    fontSize: FontSize.xl,
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
  formScroll: {
    gap: Spacing[4],
    paddingBottom: Spacing[2],
  },
  avatarSection: {
    alignItems: 'center',
    gap: Spacing[3],
  },
  avatarPickerBox: {
    width: 88,
    height: 88,
    borderRadius: Radius['2xl'],
    position: 'relative',
  },
  avatarPreviewImg: {
    width: 88,
    height: 88,
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surfaceAlt,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: Radius['2xl'],
    backgroundColor: '#26221D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCornerBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    borderWidth: 2.5,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.xs,
  },
  photoActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing[2],
  },
  photoActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing[3],
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  photoRemovePill: {
    backgroundColor: Colors.errorLight,
  },
  photoActionText: {
    fontFamily: FontFamily.semiBold,
    color: Colors.primaryDark,
    fontSize: FontSize.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing[3],
    marginTop: Spacing[1],
  },
  cancelBtn: {
    flex: 1,
  },
  saveBtn: {
    flex: 1.5,
  },
});
