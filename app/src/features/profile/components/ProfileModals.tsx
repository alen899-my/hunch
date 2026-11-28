import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Switch,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, Input } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize, Shadow } from '@/theme';
import { useAuth } from '@/hooks/use-auth';
import { useThemeColors } from '@/hooks/use-mood-theme';
import { useAppLock } from '@/hooks/use-app-lock';
import { getSafeBottomPadding, getSafeTopPadding } from '@/utils/safe-area';

// ── 1. Edit Profile Modal ────────────────────────────────────────────────────
export function EditProfileModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [localAvatar, setLocalAvatar] = useState<{ uri: string; mimeType: string } | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setLocalAvatar(null);
    setAvatarRemoved(false);
    setSaving(false);
  }, [visible, user]);

  const previewUri = avatarRemoved ? null : localAvatar?.uri || user?.avatar || null;

  const pickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Gallery access needed', 'Please allow gallery access to update your avatar.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      setLocalAvatar({ uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg' });
      setAvatarRemoved(false);
    } catch {
      Alert.alert('Could not select photo', 'Please try again.');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone) {
      const digits = trimmedPhone.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        Alert.alert('Invalid phone', 'Please enter a valid phone number.');
        return;
      }
    } else if (!user?.email) {
      Alert.alert('Phone required', 'Phone number cannot be empty when no email is linked.');
      return;
    }

    const phonePayload = trimmedPhone
      ? trimmedPhone
      : user?.phone
      ? null
      : undefined;

    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        ...(phonePayload !== undefined ? { phone: phonePayload } : {}),
        localAvatar,
        avatarRemoved,
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Could not update profile.');
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
        <View style={[styles.sheet, { paddingBottom: safeBottom }]}>
          <View style={styles.handleBar} />
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <AppText style={styles.sheetTitle}>Edit Profile</AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formGap}>
            <View style={styles.avatarCenter}>
              <TouchableOpacity onPress={pickPhoto} activeOpacity={0.85} style={styles.avatarBox}>
                {previewUri ? (
                  <Image source={{ uri: previewUri }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Ionicons name="person" size={34} color={Colors.white} />
                  </View>
                )}
                <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
                  <Ionicons name="camera" size={14} color={Colors.white} />
                </View>
              </TouchableOpacity>

              <View style={styles.photoRow}>
                <TouchableOpacity onPress={pickPhoto} style={[styles.pillBtn, { backgroundColor: colors.primaryLight }]}>
                  <AppText variant="caption" style={[styles.pillText, { color: colors.primaryDark }]}>
                    Change Photo
                  </AppText>
                </TouchableOpacity>
                {previewUri && (
                  <TouchableOpacity
                    onPress={() => {
                      setLocalAvatar(null);
                      setAvatarRemoved(true);
                    }}
                    style={[styles.pillBtn, { backgroundColor: Colors.errorLight }]}
                  >
                    <AppText variant="caption" style={[styles.pillText, { color: Colors.error }]}>
                      Remove
                    </AppText>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <Input
              label="Display Name"
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Input
              label="Phone Number"
              placeholder="+1 555 123 4567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />

            <View style={styles.actionsRow}>
              <Button
                label="Cancel"
                variant="secondary"
                size="md"
                fullWidth={false}
                onPress={onClose}
                style={{ flex: 1 }}
              />
              <Button
                label="Save"
                variant="primary"
                size="md"
                loading={saving}
                fullWidth={false}
                onPress={handleSave}
                style={{ flex: 1.4 }}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── 2. Reminders Modal ───────────────────────────────────────────────────────
export function RemindersModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { reminders, updateReminders } = useAppLock();

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
      <View style={styles.keyboardAvoid} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: safeBottom }]}>
          <View style={styles.handleBar} />
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <AppText style={styles.sheetTitle}>Daily Reminders</AppText>
              <AppText variant="caption" color={Colors.textSecondary}>
                Gentle check-in prompts on your Home screen
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.settingCard, { backgroundColor: colors.background }]}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyMd">Morning Intention</AppText>
                <AppText variant="caption" color={Colors.textSecondary}>
                  Prompt before noon when you haven&apos;t written yet
                </AppText>
              </View>
              <Switch
                value={reminders.morningEnabled}
                onValueChange={(v) => updateReminders({ morningEnabled: v })}
                trackColor={{ false: '#DFDCD5', true: colors.primaryLight }}
                thumbColor={reminders.morningEnabled ? colors.primary : '#FFFFFF'}
              />
            </View>

            <View style={styles.settingDivider} />

            <View style={styles.settingRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyMd">Evening Reflection</AppText>
                <AppText variant="caption" color={Colors.textSecondary}>
                  Prompt in the evening to capture your day
                </AppText>
              </View>
              <Switch
                value={reminders.eveningEnabled}
                onValueChange={(v) => updateReminders({ eveningEnabled: v })}
                trackColor={{ false: '#DFDCD5', true: colors.primaryLight }}
                thumbColor={reminders.eveningEnabled ? colors.primary : '#FFFFFF'}
              />
            </View>
          </View>

          <Button label="Done" variant="primary" size="md" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

// ── 3. Privacy & Security (4-digit PIN Lock) Modal ───────────────────────────
export function PrivacySecurityModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { pinEnabled, setAppPin, removeAppPin } = useAppLock();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  useEffect(() => {
    if (!visible) return;
    setPin('');
    setConfirmPin('');
  }, [visible]);

  const handleSavePin = async () => {
    if (!/^\d{4}$/.test(pin)) {
      Alert.alert('Invalid PIN', 'Please enter a 4-digit numeric PIN.');
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert('PIN mismatch', 'Both PIN entries must match.');
      return;
    }
    await setAppPin(pin);
    Alert.alert('App Lock Enabled', 'Hunch will require your 4-digit PIN on launch.');
    onClose();
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
        <View style={[styles.sheet, { paddingBottom: safeBottom }]}>
          <View style={styles.handleBar} />
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <AppText style={styles.sheetTitle}>Privacy & App Lock</AppText>
              <AppText variant="caption" color={Colors.textSecondary}>
                Protect your private journal with a 4-digit PIN
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {pinEnabled ? (
            <View style={styles.formGap}>
              <View style={[styles.pinActiveBox, { backgroundColor: colors.successLight }]}>
                <Ionicons name="lock-closed" size={20} color={colors.success} />
                <AppText variant="bodyMd" color={colors.success} style={{ flex: 1 }}>
                  4-digit App Lock is active
                </AppText>
              </View>
              <Button
                label="Disable App Lock"
                variant="danger"
                size="md"
                onPress={async () => {
                  await removeAppPin();
                  onClose();
                }}
              />
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formGap}>
              <Input
                label="New 4-digit PIN"
                placeholder="••••"
                value={pin}
                onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
              />
              <Input
                label="Confirm PIN"
                placeholder="••••"
                value={confirmPin}
                onChangeText={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
              />
              <Button label="Enable PIN Lock" variant="primary" size="md" onPress={handleSavePin} />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── 4. Fullscreen App Lock Overlay Gate ──────────────────────────────────────
export function AppLockOverlay() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { isLocked, lockoutSeconds, unlockWithPin } = useAppLock();
  const [entered, setEntered] = useState('');
  const [wrong, setWrong] = useState(false);

  if (!isLocked) return null;

  const isCompactHeight = height < 700;
  const keyHeight = isCompactHeight ? 54 : 64;
  const isCooldown = lockoutSeconds > 0;

  const handleDigit = (digit: string) => {
    if (isCooldown || entered.length >= 4) return;
    const next = entered + digit;
    setEntered(next);
    setWrong(false);
    if (next.length === 4) {
      const ok = unlockWithPin(next);
      if (!ok) {
        setWrong(true);
        setTimeout(() => setEntered(''), 260);
      } else {
        setEntered('');
      }
    }
  };

  const safeTop = getSafeTopPadding(insets.top, 16, 36, 52);
  const safeBottom = getSafeBottomPadding(insets.bottom, 20, 48, 36);

  return (
    <Modal visible statusBarTranslucent navigationBarTranslucent animationType="fade">
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[
          styles.lockScreen,
          { backgroundColor: colors.background, paddingTop: safeTop, paddingBottom: safeBottom },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.lockHeader, isCompactHeight && { marginTop: Spacing[4] }]}>
          <View style={[styles.lockIconCircle, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="lock-closed" size={28} color={colors.primary} />
          </View>
          <AppText style={styles.lockTitle}>Hunch is Locked</AppText>
          <AppText variant="body" color={Colors.textSecondary} align="center">
            {isCooldown
              ? `Too many incorrect attempts. Try again in ${lockoutSeconds}s`
              : wrong
              ? 'Incorrect PIN, try again'
              : 'Enter your 4-digit PIN to continue'}
          </AppText>

          <View style={styles.pinDotsRow}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.pinDot,
                  entered.length > i && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                  wrong && styles.pinDotError,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.keypadGrid}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['', '0', 'del'],
          ].map((row, rIdx) => (
            <View key={rIdx} style={styles.keypadRow}>
              {row.map((cell, cIdx) => {
                if (cell === '') {
                  return <View key={`empty-${cIdx}`} style={[styles.keypadBtnEmpty, { height: keyHeight }]} />;
                }
                if (cell === 'del') {
                  return (
                    <TouchableOpacity
                      key="del"
                      onPress={() => {
                        setWrong(false);
                        setEntered((prev) => prev.slice(0, -1));
                      }}
                      style={[styles.keypadBtn, { height: keyHeight }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="backspace-outline" size={24} color={Colors.text} />
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity
                    key={cell}
                    onPress={() => handleDigit(cell)}
                    style={[styles.keypadBtn, { height: keyHeight }]}
                    activeOpacity={0.7}
                  >
                    <AppText variant="h2" style={styles.keypadDigit}>
                      {cell}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </Modal>
  );
}

// ── 5. Change Password Modal ─────────────────────────────────────────────────
export function ChangePasswordModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 380;
  const isCompactHeight = height < 700;
  const { user, changePassword } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setOldPassword('');
    setNewPassword('');
    setShowOld(false);
    setShowNew(false);
    setSaving(false);
  }, [visible]);

  const handleSave = async () => {
    if (user?.provider !== 'google' && !oldPassword) {
      Alert.alert('Current password required', 'Please enter your old password.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Password too short', 'New password must be at least 6 characters.');
      return;
    }
    if (oldPassword && oldPassword === newPassword) {
      Alert.alert('Same password', 'New password must be different from your old password.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(oldPassword, newPassword);
      Alert.alert('Password updated', 'Your password has been updated.');
      onClose();
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Could not update password.');
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
        <View
          style={[
            styles.sheet,
            isSmallPhone && { paddingHorizontal: Spacing[4] },
            { paddingBottom: safeBottom },
          ]}
        >
          <View style={styles.handleBar} />
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <AppText style={[styles.sheetTitle, isSmallPhone && { fontSize: FontSize.lg }]} numberOfLines={1}>
                Change Password
              </AppText>
              <AppText variant="caption" color={Colors.textSecondary} numberOfLines={2}>
                {user?.provider === 'google'
                  ? 'Set a password or update your current one'
                  : 'Verify your old password to set a new one'}
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={[
              styles.formGap,
              isCompactHeight && { gap: Spacing[3] },
            ]}
          >
            <Input
              label="Old Password"
              placeholder={user?.provider === 'google' ? 'Enter old password (if set)' : 'Enter old password'}
              value={oldPassword}
              onChangeText={setOldPassword}
              secureTextEntry={!showOld}
              autoCapitalize="none"
              autoCorrect={false}
              rightIcon={
                <TouchableOpacity onPress={() => setShowOld((v) => !v)} hitSlop={8}>
                  <Ionicons
                    name={showOld ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
              }
            />

            <Input
              label="New Password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNew}
              autoCapitalize="none"
              autoCorrect={false}
              rightIcon={
                <TouchableOpacity onPress={() => setShowNew((v) => !v)} hitSlop={8}>
                  <Ionicons
                    name={showNew ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
              }
            />

            {isSmallPhone ? (
              <View style={styles.actionsCol}>
                <Button
                  label="Update Password"
                  variant="primary"
                  size="md"
                  loading={saving}
                  onPress={handleSave}
                />
                <Button
                  label="Cancel"
                  variant="secondary"
                  size="md"
                  onPress={onClose}
                />
              </View>
            ) : (
              <View style={styles.actionsRow}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  size="md"
                  fullWidth={false}
                  onPress={onClose}
                  style={{ flex: 1, paddingHorizontal: 14 }}
                />
                <Button
                  label="Update Password"
                  variant="primary"
                  size="md"
                  loading={saving}
                  fullWidth={false}
                  onPress={handleSave}
                  style={{ flex: 1.6, paddingHorizontal: 14 }}
                />
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingTop: Spacing[3],
    paddingHorizontal: Spacing[5],
    gap: Spacing[4],
    maxHeight: '88%',
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
    ...Shadow.lg,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DCD8CE',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing[2],
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
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
  formGap: {
    gap: Spacing[4],
    paddingBottom: Spacing[2],
  },
  avatarCenter: {
    alignItems: 'center',
    gap: Spacing[3],
  },
  avatarBox: {
    width: 88,
    height: 88,
    borderRadius: Radius['2xl'],
    position: 'relative',
  },
  avatarImg: {
    width: 88,
    height: 88,
    borderRadius: Radius['2xl'],
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: Radius['2xl'],
    backgroundColor: '#26221D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
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
  },
  photoRow: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  pillBtn: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing[3],
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  pillText: {
    fontFamily: FontFamily.semiBold,
    color: Colors.primaryDark,
    fontSize: FontSize.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing[3],
    marginTop: Spacing[1],
  },
  actionsCol: {
    flexDirection: 'column',
    gap: Spacing[2],
    marginTop: Spacing[1],
  },
  settingCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: '#ECEAE4',
    gap: Spacing[3],
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  settingDivider: {
    height: 1,
    backgroundColor: '#ECEAE4',
  },
  pinActiveBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.successLight,
    padding: Spacing[4],
    borderRadius: Radius.xl,
  },

  lockScreen: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[6],
    gap: Spacing[6],
  },
  lockHeader: {
    alignItems: 'center',
    gap: Spacing[2],
    marginTop: Spacing[8],
  },
  lockIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[2],
  },
  lockTitle: {
    fontFamily: FontFamily.editorial,
    fontSize: 26,
    color: '#241B14',
  },
  pinDotsRow: {
    flexDirection: 'row',
    gap: Spacing[4],
    marginTop: Spacing[4],
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D6D0C4',
    backgroundColor: 'transparent',
  },
  pinDotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pinDotError: {
    borderColor: Colors.error,
    backgroundColor: Colors.error,
  },
  keypadGrid: {
    gap: Spacing[3],
    maxWidth: 300,
    width: '100%',
    alignSelf: 'center',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing[3],
  },
  keypadBtn: {
    flex: 1,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ECEAE4',
    ...Shadow.xs,
  },
  keypadBtnEmpty: {
    flex: 1,
    height: 64,
  },
  keypadDigit: {
    fontFamily: FontFamily.semiBold,
    color: '#241B14',
  },
});
