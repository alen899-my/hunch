import React, { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize } from '@/theme';
import { useThemeColors } from '@/hooks/use-mood-theme';
import {
  playTypewriterSound,
  toggleTypewriterMute,
  isTypewriterMuted,
} from '@/services/typewriter-sound.service';
import { getSafeBottomPadding } from '@/utils/safe-area';

interface TypewriterKeyboardProps {
  onKeyPress: (char: string) => void;
  onBackspace: () => void;
  onSend: () => void;
  onSwitchToNative: () => void;
  canSend: boolean;
}

const ROW_1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
const ROW_2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
const ROW_3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];

const NUM_ROW_1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const NUM_ROW_2 = ['@', '#', '$', '%', '&', '*', '-', '+', '(', ')'];
const NUM_ROW_3 = ['!', '"', "'", ':', ';', '/', '?'];

// ── Memoized 3D Tactile Keycap Component ─────────────────────────────────────
interface KeyCapProps {
  label: string;
  isShifted?: boolean;
  onPress: (char: string) => void;
  width?: number;
  height?: number;
  compactText?: boolean;
}

const KeyCap = React.memo(function KeyCap({
  label,
  isShifted,
  onPress,
  width,
  height,
  compactText,
}: KeyCapProps) {
  const displayChar = isShifted ? label.toUpperCase() : label.toLowerCase();

  const handlePress = useCallback(() => {
    playTypewriterSound('key');
    onPress(displayChar);
  }, [onPress, displayChar]);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      style={[
        styles.keyBase,
        width ? { width } : null,
        height ? { height } : null,
      ]}
    >
      <View style={styles.keyCap3D}>
        <AppText style={[styles.keyText, compactText && { fontSize: 16 }]}>
          {displayChar}
        </AppText>
      </View>
    </TouchableOpacity>
  );
});

export function TypewriterKeyboard({
  onKeyPress,
  onBackspace,
  onSend,
  onSwitchToNative,
  canSend,
}: TypewriterKeyboardProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 360;
  const kbWidth = Math.min(width, 540);
  const keyGap = isSmallPhone ? 3 : 4;
  const keyW = Math.max(24, Math.floor((kbWidth - 12 - keyGap * 9) / 10));
  const keyH = height < 680 ? 39 : 44;
  const actionKeyW = Math.floor(keyW * 1.32);
  const modeKeyW = Math.floor(keyW * 1.28);
  const safeBottom = getSafeBottomPadding(insets.bottom, 16, 48, 32);
  const [isShifted, setIsShifted] = useState(false);
  const [isSymbolMode, setIsSymbolMode] = useState(false);
  const [muted, setMuted] = useState(isTypewriterMuted());

  const handleChar = useCallback(
    (char: string) => {
      onKeyPress(char);
      if (isShifted) setIsShifted(false);
    },
    [onKeyPress, isShifted]
  );

  const handleSpace = useCallback(() => {
    playTypewriterSound('space');
    onKeyPress(' ');
  }, [onKeyPress]);

  const handleBackspacePress = useCallback(() => {
    playTypewriterSound('backspace');
    onBackspace();
  }, [onBackspace]);

  const handleSendPress = useCallback(() => {
    if (!canSend) return;
    playTypewriterSound('bell');
    onSend();
  }, [canSend, onSend]);

  const handleToggleSound = useCallback(() => {
    const nowMuted = toggleTypewriterMute();
    setMuted(nowMuted);
  }, []);

  const handleShiftToggle = useCallback(() => {
    playTypewriterSound('key');
    setIsShifted((prev) => !prev);
  }, []);

  const handleModeToggle = useCallback(() => {
    playTypewriterSound('key');
    setIsSymbolMode((prev) => !prev);
  }, []);

  const currentRow1 = isSymbolMode ? NUM_ROW_1 : ROW_1;
  const currentRow2 = isSymbolMode ? NUM_ROW_2 : ROW_2;
  const currentRow3 = isSymbolMode ? NUM_ROW_3 : ROW_3;

  return (
    <View style={[styles.keyboardContainer, { paddingBottom: safeBottom }]}>
      <View style={styles.keyboardInner}>
        {/* ── Minimalist Top Controls (Theme Based, Non-AI) ── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={handleToggleSound}
            style={styles.topPillBtn}
            activeOpacity={0.75}
            hitSlop={8}
          >
            <Ionicons
              name={muted ? 'volume-mute' : 'volume-high'}
              size={16}
              color={muted ? Colors.textMuted : colors.primary}
              style={{ marginRight: 5 }}
            />
            <AppText style={styles.topPillText}>
              {muted ? 'Sound Off' : 'Sound On'}
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onSwitchToNative}
            style={styles.topPillBtn}
            activeOpacity={0.75}
            hitSlop={8}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={14}
              color={Colors.textSecondary}
              style={{ marginRight: 5 }}
            />
            <AppText style={styles.topPillText}>System Keyboard</AppText>
          </TouchableOpacity>
        </View>

        {/* ── Row 1 ── */}
        <View style={[styles.row, { gap: keyGap }]}>
          {currentRow1.map((char) => (
            <KeyCap
              key={char}
              label={char}
              isShifted={isShifted && !isSymbolMode}
              onPress={handleChar}
              width={keyW}
              height={keyH}
              compactText={isSmallPhone}
            />
          ))}
        </View>

        {/* ── Row 2 ── */}
        <View style={[styles.row, { gap: keyGap }]}>
          {currentRow2.map((char) => (
            <KeyCap
              key={char}
              label={char}
              isShifted={isShifted && !isSymbolMode}
              onPress={handleChar}
              width={keyW}
              height={keyH}
              compactText={isSmallPhone}
            />
          ))}
        </View>

        {/* ── Row 3: Shift, Letters, Backspace ── */}
        <View style={[styles.row, { gap: keyGap }]}>
          {/* 3D Shift Key */}
          <TouchableOpacity
            onPress={handleShiftToggle}
            activeOpacity={0.7}
            style={[styles.keyBase, { width: actionKeyW, height: keyH }]}
          >
            <View
              style={[
                styles.actionKeyCap3D,
                isShifted && [
                  styles.shiftActiveCap3D,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.primaryDark,
                    borderBottomColor: colors.primaryText,
                  },
                ],
              ]}
            >
              <Ionicons
                name={isShifted ? 'arrow-up' : 'arrow-up-outline'}
                size={18}
                color={isShifted ? '#FFFFFF' : '#38342E'}
              />
            </View>
          </TouchableOpacity>

          {currentRow3.map((char) => (
            <KeyCap
              key={char}
              label={char}
              isShifted={isShifted && !isSymbolMode}
              onPress={handleChar}
              width={keyW}
              height={keyH}
              compactText={isSmallPhone}
            />
          ))}

          {/* 3D Backspace Key */}
          <TouchableOpacity
            onPress={handleBackspacePress}
            activeOpacity={0.7}
            style={[styles.keyBase, { width: actionKeyW, height: keyH }]}
          >
            <View style={styles.actionKeyCap3D}>
              <Feather name="delete" size={17} color="#38342E" />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Row 4: 123 Switch, Comma, 3D Spacebar, Dot, 3D Amber Send Key ── */}
        <View style={[styles.row, { gap: keyGap }]}>
          {/* Numbers / Letters Mode Switcher */}
          <TouchableOpacity
            onPress={handleModeToggle}
            activeOpacity={0.7}
            style={[styles.keyBase, { width: modeKeyW, height: keyH }]}
          >
            <View style={styles.actionKeyCap3D}>
              <AppText style={styles.modeKeyText}>
                {isSymbolMode ? 'ABC' : '?123'}
              </AppText>
            </View>
          </TouchableOpacity>

          {/* Comma Key */}
          <KeyCap
            label=","
            onPress={handleChar}
            width={keyW}
            height={keyH}
            compactText={isSmallPhone}
          />

          {/* 3D Spacebar (Theme Cream/White) */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={handleSpace}
            style={[styles.spacebarBase, { height: keyH }]}
          >
            <View style={styles.spacebarCap3D}>
              <AppText style={styles.spacebarText}>space</AppText>
            </View>
          </TouchableOpacity>

          {/* Dot Key */}
          <KeyCap
            label="."
            onPress={handleChar}
            width={keyW}
            height={keyH}
            compactText={isSmallPhone}
          />

          {/* 3D Amber Return / Send Key */}
          <TouchableOpacity
            onPress={handleSendPress}
            activeOpacity={0.8}
            disabled={!canSend}
            style={[styles.keyBase, { width: actionKeyW, height: keyH }]}
          >
            <View
              style={[
                styles.returnKeyCap3D,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primaryDark,
                  borderBottomColor: colors.primaryText,
                  shadowColor: colors.primary,
                },
                !canSend && styles.returnKeyCapDisabled,
              ]}
            >
              <Ionicons
                name="return-down-back"
                size={20}
                color={canSend ? '#FFFFFF' : '#8C867C'}
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    backgroundColor: '#EBE7E0', // Soft tactile warm stone plate matching Hunch theme
    borderTopWidth: 1,
    borderTopColor: '#DDD7CD',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  keyboardInner: {
    width: '100%',
    maxWidth: 540,
    gap: 7,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  topPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#DFD9CE',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  topPillText: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.medium,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  // ── 3D Mechanical Keycap Geometry ───
  keyBase: {
    height: 44,
  },
  keyCap3D: {
    width: '100%',
    height: '100%',
    borderRadius: 7,
    backgroundColor: '#FFFFFF', // Crisp clean keycap surface
    borderWidth: 1,
    borderColor: '#E2DDD4',
    borderBottomWidth: 3.5, // 3D Bottom Lip / Drop Bevel
    borderBottomColor: '#C8C2B5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 1,
    elevation: 2,
  },
  keyText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 18,
    color: '#1A1A1A',
  },

  // ── Action Keys (Shift, Backspace, 123) ───
  actionKeyCap3D: {
    width: '100%',
    height: '100%',
    borderRadius: 7,
    backgroundColor: '#DDD8CE', // Tactile subtle grey-stone
    borderWidth: 1,
    borderColor: '#CAC4B6',
    borderBottomWidth: 3.5, // 3D Drop Edge
    borderBottomColor: '#B6AF9F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  shiftActiveCap3D: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
    borderBottomColor: Colors.primaryText,
  },

  // ── Mode Key (?123) ───
  modeKeyText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#38342E',
  },

  // ── 3D Spacebar ───
  spacebarBase: {
    flex: 1,
    height: 44,
    marginHorizontal: 2,
  },
  spacebarCap3D: {
    width: '100%',
    height: '100%',
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2DDD4',
    borderBottomWidth: 3.5,
    borderBottomColor: '#C8C2B5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 1,
    elevation: 2,
  },
  spacebarText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#A8A49C',
  },

  // ── 3D Amber Return / Send Key ───
  returnKeyCap3D: {
    width: '100%',
    height: '100%',
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.primaryDark,
    borderBottomWidth: 3.5, // 3D Drop Edge
    borderBottomColor: Colors.primaryText,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  returnKeyCapDisabled: {
    backgroundColor: '#DDD8CE',
    borderColor: '#CAC4B6',
    borderBottomColor: '#B6AF9F',
    shadowOpacity: 0,
    elevation: 1,
  },
});
