import React, { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { AppText } from '@/components/ui';
import { Colors, Spacing, Radius, FontFamily, FontSize } from '@/theme';
import {
  playTypewriterSound,
  toggleTypewriterMute,
  isTypewriterMuted,
} from '@/services/typewriter-sound.service';

const SCREEN_W = Dimensions.get('window').width;

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
}

const KeyCap = React.memo(function KeyCap({
  label,
  isShifted,
  onPress,
  width,
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
      style={[styles.keyBase, width ? { width } : null]}
    >
      <View style={styles.keyCap3D}>
        <AppText style={styles.keyText}>{displayChar}</AppText>
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
    <View style={styles.keyboardContainer}>
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
            color={muted ? Colors.textMuted : Colors.primary}
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
      <View style={styles.row}>
        {currentRow1.map((char) => (
          <KeyCap
            key={char}
            label={char}
            isShifted={isShifted && !isSymbolMode}
            onPress={handleChar}
          />
        ))}
      </View>

      {/* ── Row 2 ── */}
      <View style={styles.row}>
        {currentRow2.map((char) => (
          <KeyCap
            key={char}
            label={char}
            isShifted={isShifted && !isSymbolMode}
            onPress={handleChar}
          />
        ))}
      </View>

      {/* ── Row 3: Shift, Letters, Backspace ── */}
      <View style={styles.row}>
        {/* 3D Shift Key */}
        <TouchableOpacity
          onPress={handleShiftToggle}
          activeOpacity={0.7}
          style={[styles.keyBase, styles.actionKey]}
        >
          <View
            style={[
              styles.actionKeyCap3D,
              isShifted && styles.shiftActiveCap3D,
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
          />
        ))}

        {/* 3D Backspace Key */}
        <TouchableOpacity
          onPress={handleBackspacePress}
          activeOpacity={0.7}
          style={[styles.keyBase, styles.actionKey]}
        >
          <View style={styles.actionKeyCap3D}>
            <Feather name="delete" size={17} color="#38342E" />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Row 4: 123 Switch, Comma, 3D Spacebar, Dot, 3D Amber Send Key ── */}
      <View style={styles.row}>
        {/* Numbers / Letters Mode Switcher */}
        <TouchableOpacity
          onPress={handleModeToggle}
          activeOpacity={0.7}
          style={[styles.keyBase, styles.modeKey]}
        >
          <View style={styles.actionKeyCap3D}>
            <AppText style={styles.modeKeyText}>
              {isSymbolMode ? 'ABC' : '?123'}
            </AppText>
          </View>
        </TouchableOpacity>

        {/* Comma Key */}
        <KeyCap label="," onPress={handleChar} width={KEY_W} />

        {/* 3D Spacebar (Theme Cream/White) */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={handleSpace}
          style={styles.spacebarBase}
        >
          <View style={styles.spacebarCap3D}>
            <AppText style={styles.spacebarText}>space</AppText>
          </View>
        </TouchableOpacity>

        {/* Dot Key */}
        <KeyCap label="." onPress={handleChar} width={KEY_W} />

        {/* 3D Amber Return / Send Key */}
        <TouchableOpacity
          onPress={handleSendPress}
          activeOpacity={0.8}
          disabled={!canSend}
          style={[styles.keyBase, styles.returnKey]}
        >
          <View
            style={[
              styles.returnKeyCap3D,
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
  );
}

// Keycap width dynamically calculated to fit 10 keys per row cleanly
const KEY_W = Math.floor((SCREEN_W - 24) / 10) - 3;

const styles = StyleSheet.create({
  keyboardContainer: {
    backgroundColor: '#EBE7E0', // Soft tactile warm stone plate matching Hunch theme
    borderTopWidth: 1,
    borderTopColor: '#DDD7CD',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingHorizontal: 6,
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
    width: KEY_W,
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
  actionKey: {
    width: Math.floor(KEY_W * 1.35),
  },
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
    borderColor: '#E09518',
    borderBottomColor: '#C47D10',
  },

  // ── Mode Key (?123) ───
  modeKey: {
    width: Math.floor(KEY_W * 1.3),
  },
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
  returnKey: {
    width: Math.floor(KEY_W * 1.35),
  },
  returnKeyCap3D: {
    width: '100%',
    height: '100%',
    borderRadius: 7,
    backgroundColor: Colors.primary, // Hunch Amber CTA!
    borderWidth: 1,
    borderColor: '#DE8E13',
    borderBottomWidth: 3.5, // 3D Drop Edge
    borderBottomColor: '#C27C0E',
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
