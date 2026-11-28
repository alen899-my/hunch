import React from 'react';
import { Tabs } from 'expo-router';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow, Spacing } from '@/theme';
import { useThemeColors } from '@/hooks/use-mood-theme';
import { getSafeBottomPadding } from '@/utils/safe-area';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: {
  name: string;
  icon: IoniconsName;
  iconFocused: IoniconsName;
  label: string;
}[] = [
  { name: 'index',    icon: 'home-outline',        iconFocused: 'home',        label: 'Home'     },
  { name: 'thoughts', icon: 'chatbubbles-outline',  iconFocused: 'chatbubbles', label: 'Thoughts' },
  { name: 'people',   icon: 'people-outline',       iconFocused: 'people',      label: 'People'   },
  { name: 'profile',  icon: 'person-outline',       iconFocused: 'person',      label: 'Profile'  },
];

// ── Floating custom tab bar ──────────────────────────────────
function FloatingTabBar(props: any) {
  const colors = useThemeColors();
  const { state, navigateToTab, navigation } = props;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const barWidth  = Math.min(width - Spacing[8] * 2, 400);
  const barBottom = getSafeBottomPadding(insets.bottom, Spacing[4], 44, 32);

  return (
    <View
      pointerEvents="box-none"
      style={[s.wrapper, { bottom: barBottom }]}
    >
      <View style={[s.bar, { width: barWidth }]}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const tab = TABS[index];
          if (!tab) return null;

          const onPress = () => {
            if (!isFocused) {
              if (typeof navigateToTab === 'function') {
                navigateToTab(route.key);
              } else if (navigation?.navigate) {
                navigation.navigate(route.name);
              }
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isFocused }}
              style={s.tab}
            >
              {/* Rounded pill indicator behind active icon */}
              <View style={[s.pill, isFocused && [s.pillActive, { backgroundColor: colors.primaryLight }]]}>
                <Ionicons
                  name={isFocused ? tab.iconFocused : tab.icon}
                  size={22}
                  color={isFocused ? colors.primary : Colors.textMuted}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Layout ───────────────────────────────────────────────────
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, lazy: false }}
    >
      {TABS.map(({ name }) => (
        <Tabs.Screen key={name} name={name} />
      ))}
    </Tabs>
  );
}

const s = StyleSheet.create({
  // Absolutely positioned container that doesn't block scroll
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // Floating pill bar
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[3],
    ...Shadow.lg,
    // Subtle border
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  // Each tab button
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  // Icon background pill
  pill: {
    width: 58,
    height: 40,
    borderRadius: Radius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: Colors.primaryLight,
  },
});
