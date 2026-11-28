import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/layout/Screen';
import { AppText, Avatar, Card, Button, Divider } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize } from '@/theme';
import { useAuth } from '@/hooks/use-auth';
import { useThemeColors } from '@/hooks/use-mood-theme';
import { useAppLock } from '@/hooks/use-app-lock';
import {
  EditProfileModal,
  ChangePasswordModal,
  RemindersModal,
  PrivacySecurityModal,
} from '@/features/profile/components/ProfileModals';

export default function ProfileTab() {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const isSmallPhone = width < 370;
  const { user, logout } = useAuth();
  const { pinEnabled } = useAppLock();

  const [showEdit, setShowEdit] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const handleLogout = () => {
    logout();
    router.replace('/get-started');
  };

  const rows = [
    {
      icon: 'person-outline',
      label: 'Edit Profile',
      onPress: () => setShowEdit(true),
    },
    {
      icon: 'key-outline',
      label: 'Change Password',
      onPress: () => setShowChangePassword(true),
    },
    {
      icon: 'notifications-outline',
      label: 'Notifications & Reminders',
      onPress: () => setShowReminders(true),
    },
    {
      icon: 'lock-closed-outline',
      label: pinEnabled ? 'Privacy & Security (PIN On)' : 'Privacy & Security',
      onPress: () => setShowPrivacy(true),
    },
    {
      icon: 'help-circle-outline',
      label: 'Help & Support',
      onPress: () =>
        Alert.alert(
          'Hunch Journal',
          'Tip: Use @name to mention people and #topic to organize thoughts. Long-press any chat bubble to star, reply, edit, or delete.'
        ),
    },
  ];

  return (
    <Screen scroll bg={colors.background} tabScreen>
      {/* Centred layout on tablet */}
      <View style={[styles.container, isTablet && styles.containerTablet]}>
        {/* Top Profile Card UI */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => setShowEdit(true)}>
          <Card style={styles.profileCard} shadow="xs" padding={Spacing[4]}>
            <View style={styles.profileHeader}>
              <Avatar
                initials={user?.name?.slice(0, 2) ?? 'U'}
                uri={user?.avatar}
                size={isSmallPhone ? 'lg' : 'xl'}
              />
              <View style={styles.profileInfo}>
                <AppText
                  numberOfLines={1}
                  style={[styles.profileName, isSmallPhone && { fontSize: 20, lineHeight: 25 }]}
                >
                  {user?.name ?? 'User'}
                </AppText>

                {user?.email ? (
                  <View style={styles.contactRow}>
                    <Ionicons name="mail-outline" size={13} color={Colors.textSecondary} />
                    <AppText
                      variant="caption"
                      color={Colors.textSecondary}
                      numberOfLines={1}
                      style={styles.contactText}
                    >
                      {user.email}
                    </AppText>
                  </View>
                ) : null}

                <View style={styles.contactRow}>
                  <Ionicons
                    name="call-outline"
                    size={13}
                    color={user?.phone ? colors.primaryDark : Colors.textMuted}
                  />
                  <AppText
                    variant="caption"
                    color={user?.phone ? colors.primaryDark : Colors.textMuted}
                    numberOfLines={1}
                    style={[styles.contactText, user?.phone && { fontFamily: FontFamily.semiBold }]}
                  >
                    {user?.phone || 'Add phone number'}
                  </AppText>
                </View>
              </View>

              <View style={[styles.editIconBtn, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="create-outline" size={18} color={colors.primaryDark} />
              </View>
            </View>
          </Card>
        </TouchableOpacity>

        {/* Settings rows */}
        <Card shadow="xs" padding={Spacing[4]}>
          {rows.map(({ icon, label, onPress }, i, arr) => (
            <View key={label}>
              <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
                <Ionicons name={icon as any} size={20} color={Colors.textSecondary} />
                <AppText variant="bodyMd" style={styles.rowLabel}>
                  {label}
                </AppText>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
              {i < arr.length - 1 && <Divider style={styles.rowDivider} />}
            </View>
          ))}
        </Card>

        {/* Logout */}
        <Button
          label="Log Out"
          variant="danger"
          size="lg"
          onPress={handleLogout}
          leftIcon={<Ionicons name="log-out-outline" size={20} color={Colors.white} />}
        />

        <AppText variant="caption" color={Colors.textMuted} align="center">
          Version 1.0.0
        </AppText>
      </View>

      <EditProfileModal visible={showEdit} onClose={() => setShowEdit(false)} />
      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
      <RemindersModal visible={showReminders} onClose={() => setShowReminders(false)} />
      <PrivacySecurityModal visible={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing[4], paddingVertical: Spacing[5] },
  containerTablet: { maxWidth: 560, alignSelf: 'center', width: '100%' },
  profileCard: {
    borderRadius: Radius['2xl'],
    borderWidth: 1.5,
    borderColor: '#ECEAE4',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  profileInfo: { flex: 1, minWidth: 0, gap: 4 },
  profileName: {
    fontFamily: FontFamily.editorial,
    fontSize: 22,
    lineHeight: 28,
    color: '#241B14',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  contactText: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.xs,
  },
  editIconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[3],
    gap: Spacing[3],
  },
  rowLabel: { flex: 1 },
  rowDivider: { marginVertical: 0 },
});
