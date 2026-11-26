import { View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/layout/Screen';
import { AppText, Avatar, Card, Button, Divider } from '@/components/ui';
import { Colors, Spacing, Radius, Shadow } from '@/theme';
import { useAuth } from '@/hooks/use-auth';

export default function ProfileTab() {
  const { width } = useWindowDimensions();
  const isTablet  = width >= 600;
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.replace('/get-started');
  };

  return (
    <Screen scroll bg={Colors.background} tabScreen>
      {/* Centred layout on tablet */}
      <View style={[styles.container, isTablet && styles.containerTablet]}>

        {/* Profile header */}
        <View style={styles.profileHeader}>
          <Avatar
            initials={user?.name?.slice(0, 2) ?? 'U'}
            uri={user?.avatar}
            size="xl"
          />
          <View style={styles.profileInfo}>
            <AppText variant="h3">{user?.name ?? 'User'}</AppText>
            {user?.email ? (
              <AppText variant="body" color={Colors.textSecondary}>{user.email}</AppText>
            ) : null}
            {user?.phone ? (
              <AppText variant="label" color={Colors.textMuted}>{user.phone}</AppText>
            ) : null}
          </View>
        </View>

        <Divider />

        {/* Settings rows */}
        <Card shadow="xs" padding={Spacing[4]}>
          {[
            { icon: 'person-outline',       label: 'Edit Profile' },
            { icon: 'notifications-outline', label: 'Notifications' },
            { icon: 'lock-closed-outline',   label: 'Privacy & Security' },
            { icon: 'help-circle-outline',   label: 'Help & Support' },
          ].map(({ icon, label }, i, arr) => (
            <View key={label}>
              <TouchableOpacity style={styles.row}>
                <Ionicons
                  name={icon as any}
                  size={20}
                  color={Colors.textSecondary}
                />
                <AppText variant="bodyMd" style={styles.rowLabel}>{label}</AppText>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing[5], paddingVertical: Spacing[6] },
  containerTablet: { maxWidth: 560, alignSelf: 'center', width: '100%' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing[4] },
  profileInfo: { flex: 1, gap: Spacing[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[3],
    gap: Spacing[3],
  },
  rowLabel: { flex: 1 },
  rowDivider: { marginVertical: 0 },
});
