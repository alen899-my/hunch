import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, AntDesign, Feather } from '@expo/vector-icons';
import {
  AppText, Button, Input, Card, Badge, Avatar, Divider, Chip,
} from '@/components/ui';
import { Colors, Spacing, Radius } from '@/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="h4">{title}</AppText>
      <Divider style={{ marginVertical: Spacing[2] }} />
      {children}
    </View>
  );
}

export default function ShowcaseScreen() {
  const [inputVal, setInputVal] = useState('');
  const [chip, setChip] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="h2" style={{ marginBottom: Spacing[2] }}>Design System</AppText>
        <AppText variant="body" color={Colors.textSecondary} style={{ marginBottom: Spacing[6] }}>
          All reusable components in one place
        </AppText>

        {/* ── Typography ─────────────────────────── */}
        <Section title="Typography">
          <AppText variant="display">Display</AppText>
          <AppText variant="h1">Heading 1</AppText>
          <AppText variant="h2">Heading 2</AppText>
          <AppText variant="h3">Heading 3</AppText>
          <AppText variant="h4">Heading 4</AppText>
          <AppText variant="title">Title</AppText>
          <AppText variant="body">Body — The quick brown fox jumps over the lazy dog.</AppText>
          <AppText variant="bodyMd">Body Medium</AppText>
          <AppText variant="label">Label / Small</AppText>
          <AppText variant="caption" color={Colors.textMuted}>Caption / Muted</AppText>
        </Section>

        {/* ── Buttons ────────────────────────────── */}
        <Section title="Buttons">
          <Button label="Primary" variant="primary" size="lg" />
          <Button label="Secondary" variant="secondary" size="md" />
          <Button label="Outline" variant="outline" size="md" />
          <Button label="Ghost" variant="ghost" size="md" />
          <Button label="Danger" variant="danger" size="md" />
          <View style={styles.row}>
            <Button
              label="With Icon"
              variant="primary"
              size="md"
              fullWidth={false}
              leftIcon={<Ionicons name="add" size={18} color={Colors.textOnPrimary} />}
            />
            <Button
              label="Google"
              variant="secondary"
              size="md"
              fullWidth={false}
              leftIcon={<AntDesign name="google" size={16} color="#4285F4" />}
            />
          </View>
          <Button label="Loading..." variant="primary" loading size="md" />
          <Button label="Disabled" variant="primary" disabled size="md" />
        </Section>

        {/* ── Inputs ─────────────────────────────── */}
        <Section title="Inputs">
          <Input
            label="Default"
            placeholder="Type something..."
            value={inputVal}
            onChangeText={setInputVal}
            leftIcon={<Feather name="edit-2" size={16} color={Colors.textMuted} />}
          />
          <Input
            label="Email"
            placeholder="you@example.com"
            keyboardType="email-address"
            hint="We'll never share your email"
            leftIcon={<Ionicons name="mail-outline" size={18} color={Colors.textMuted} />}
          />
          <Input
            label="Error State"
            placeholder="Password"
            secureTextEntry
            error="Password must be at least 6 characters"
            value=""
            onChangeText={() => {}}
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />}
          />
        </Section>

        {/* ── Cards ──────────────────────────────── */}
        <Section title="Cards">
          <Card>
            <View style={styles.cardRow}>
              <Ionicons name="journal-outline" size={20} color={Colors.primary} />
              <AppText variant="title">Default Card</AppText>
            </View>
            <AppText variant="body" color={Colors.textSecondary}>
              A clean white card with soft shadow and rounded corners.
            </AppText>
          </Card>
          <Card bg={Colors.primaryLight} shadow="xs">
            <View style={styles.cardRow}>
              <Ionicons name="sunny-outline" size={20} color={Colors.primaryText} />
              <AppText variant="title" color={Colors.primaryText}>Tinted Card</AppText>
            </View>
            <AppText variant="body" color={Colors.textSecondary}>
              Warm amber background card for highlights.
            </AppText>
          </Card>
          <Card bg={Colors.surfaceAlt} shadow="none">
            <View style={styles.cardRow}>
              <Feather name="layers" size={18} color={Colors.textSecondary} />
              <AppText variant="title">Flat Card</AppText>
            </View>
            <AppText variant="body" color={Colors.textSecondary}>
              No shadow, subtle background — for nested content.
            </AppText>
          </Card>
        </Section>

        {/* ── Badges ─────────────────────────────── */}
        <Section title="Badges & Tags">
          <View style={styles.row}>
            <Badge label="Personal" color="amber" />
            <Badge label="Family" color="pink" />
            <Badge label="Work" color="purple" />
            <Badge label="Calm" color="green" />
            <Badge label="Info" color="blue" />
            <Badge label="Default" />
          </View>
          <View style={styles.row}>
            <Badge label="Active" color="green" dot />
            <Badge label="Pending" color="amber" dot />
            <Badge label="Error" color="pink" dot />
          </View>
        </Section>

        {/* ── Chips ──────────────────────────────── */}
        <Section title="Chips (Selectable)">
          <View style={styles.row}>
            {[
              { label: 'Happy',   icon: 'happy-outline'       as IoniconsName },
              { label: 'Calm',    icon: 'leaf-outline'        as IoniconsName },
              { label: 'Sad',     icon: 'sad-outline'         as IoniconsName },
              { label: 'Anxious', icon: 'alert-circle-outline'as IoniconsName },
            ].map(({ label, icon }) => (
              <Chip
                key={label}
                label={label}
                selected={chip === label}
                onPress={() => setChip(chip === label ? null : label)}
                icon={<Ionicons
                  name={icon}
                  size={14}
                  color={chip === label ? Colors.textOnPrimary : Colors.textSecondary}
                />}
              />
            ))}
          </View>
        </Section>

        {/* ── Avatars ────────────────────────────── */}
        <Section title="Avatars">
          <View style={[styles.row, { alignItems: 'center' }]}>
            <Avatar initials="JM" size="sm" />
            <Avatar initials="JM" size="md" />
            <Avatar initials="JM" size="lg" />
            <Avatar initials="JM" size="xl" />
          </View>
        </Section>

        {/* ── Icons ──────────────────────────────── */}
        <Section title="Icons (Ionicons)">
          <View style={styles.iconGrid}>
            {([
              'home-outline', 'search-outline', 'person-outline',
              'mail-outline', 'lock-closed-outline', 'eye-outline',
              'leaf-outline', 'journal-outline', 'happy-outline',
              'sad-outline', 'arrow-back', 'add-circle-outline',
              'color-palette-outline', 'settings-outline', 'heart-outline',
            ] as IoniconsName[]).map((name) => (
              <View key={name} style={styles.iconItem}>
                <Ionicons name={name} size={24} color={Colors.text} />
                <AppText variant="caption" color={Colors.textMuted} align="center" numberOfLines={1}>
                  {name.replace('-outline', '')}
                </AppText>
              </View>
            ))}
          </View>
        </Section>

        {/* ── Dividers ───────────────────────────── */}
        <Section title="Dividers">
          <Divider />
          <Divider label="or" />
          <Divider label="continue with email" />
        </Section>

        {/* ── Color Palette ──────────────────────── */}
        <Section title="Color Palette">
          <View style={styles.swatches}>
            {([
              ['Primary',    Colors.primary],
              ['Prim Light', Colors.primaryLight],
              ['Background', Colors.background],
              ['Surface',    Colors.surface],
              ['Text',       Colors.text],
              ['Secondary',  Colors.textSecondary],
              ['Muted',      Colors.textMuted],
              ['Success',    Colors.success],
              ['Error',      Colors.error],
            ] as [string, string][]).map(([name, color]) => (
              <View key={name} style={styles.swatch}>
                <View style={[styles.swatchColor, { backgroundColor: color }]} />
                <AppText variant="caption" color={Colors.textSecondary} align="center">
                  {name}
                </AppText>
              </View>
            ))}
          </View>
        </Section>

        <View style={{ height: Spacing[12] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing[5], paddingTop: Spacing[6] },
  section: { marginBottom: Spacing[8], gap: Spacing[3] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginBottom: Spacing[2] },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[4] },
  iconItem: { alignItems: 'center', gap: 4, width: 64 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  swatch: { alignItems: 'center', gap: 4, width: 70 },
  swatchColor: {
    width: 70, height: 44, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
});
