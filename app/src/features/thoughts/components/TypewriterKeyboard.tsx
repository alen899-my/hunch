import React, { useState } from 'react';
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

// ── Circular Vintage Typewriter Keycap ────────────────────────────────────────
function TypewriterKey({
  label,
  isShifted,
  onPress,
  width,
}: {
  label: string;
  isShifted?: boolean;
  onPress: () => void;
  width?: number;
}) {
  const displayChar = isShifted ? label.toUpperCase() : label.toLowerCase();

  const handlePress = () => {
    playTypewriterSound('key');
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      style={[styles.keyOuter, width ? { width } : null]}
    >
      <View style={styles.keyRim}>
        <View style={styles.keyCenter}>
          <AppText style={styles.keyText}>{displayChar}</AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
}

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

  const handleChar = (char: string) => {
    const output = isShifted ? char.toUpperCase() : char.toLowerCase();
    onKeyPress(output);
    if (isShifted) setIsShifted(false); // standard typewriter shift behavior
  };

  const handleSpace = () => {
    playTypewriterSound('space');
    onKeyPress(' ');
  };

  const handleBackspace = () => {
    playTypewriterSound('backspace');
    onBackspace();
  };

  const handleSendPress = () => {
    if (!canSend) return;
    playTypewriterSound('bell');
    onSend();
  };

  const handleToggleSound = () => {
    const nowMuted = toggleTypewriterMute();
    setMuted(nowMuted);
  };

  const currentRow1 = isSymbolMode ? NUM_ROW_1 : ROW_1;
  const currentRow2 = isSymbolMode ? NUM_ROW_2 : ROW_2;
  const currentRow3 = isSymbolMode ? NUM_ROW_3 : ROW_3;

  return (
    <View style={styles.keyboardContainer}>
      {/* ── Top Carriage Plaque & Controls ── */}
      <View style={styles.topBar}>
        <View style={styles.brandBadge}>
          <Ionicons name="hardware-chip-outline" size={13} color="#C5A059" style={{ marginRight: 4 }} />
          <AppText style={styles.brandTitle}>HUNCH № 5</AppText>
        </View>

        <View style={styles.topActionsRow}>
          {/* Mute/Sound toggle */}
          <TouchableOpacity onPress={handleToggleSound} style={styles.topIconBtn} hitSlop={8}>
            <Ionicons
              name={muted ? 'volume-mute-outline' : 'volume-high-outline'}
              size={18}
              color={muted ? '#888075' : '#C5A059'}
            />
          </TouchableOpacity>

          {/* Switch to device native keyboard */}
          <TouchableOpacity onPress={onSwitchToNative} style={styles.topPillBtn} hitSlop={8}>
            <Ionicons name="keypad-outline" size={15} color="#DCD4C7" style={{ marginRight: 4 }} />
            <AppText style={styles.topPillText}>System</AppText>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Row 1 ── */}
      <View style={styles.row}>
        {currentRow1.map((char) => (
          <TypewriterKey
            key={char}
            label={char}
            isShifted={isShifted && !isSymbolMode}
            onPress={() => handleChar(char)}
          />
        ))}
      </View>

      {/* ── Row 2 ── */}
      <View style={styles.row}>
        {currentRow2.map((char) => (
          <TypewriterKey
            key={char}
            label={char}
            isShifted={isShifted && !isSymbolMode}
            onPress={() => handleChar(char)}
          />
        ))}
      </View>

      {/* ── Row 3: Shift / Symbols, Letters, Backspace ── */}
      <View style={styles.row}>
        {/* Shift Key */}
        <TouchableOpacity
          onPress={() => {
            playTypewriterSound('key');
            setIsShifted(!isShifted);
          }}
          activeOpacity={0.7}
          style={[styles.keyOuter, styles.specialKey, isShifted && styles.shiftActive]}
        >
          <View style={styles.keyRim}>
            <View style={[styles.keyCenter, isShifted && { backgroundColor: Colors.primary }]}>
              <Ionicons
                name="arrow-up"
                size={17}
                color={isShifted ? '#FFFFFF' : '#D8D2C5'}
              />
            </View>
          </View>
        </TouchableOpacity>

        {currentRow3.map((char) => (
          <TypewriterKey
            key={char}
            label={char}
            isShifted={isShifted && !isSymbolMode}
            onPress={() => handleChar(char)}
          />
        ))}

        {/* Backspace Key */}
        <TouchableOpacity
          onPress={handleBackspace}
          activeOpacity={0.7}
          style={[styles.keyOuter, styles.specialKey]}
        >
          <View style={styles.keyRim}>
            <View style={styles.keyCenter}>
              <Feather name="delete" size={16} color="#D8D2C5" />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Row 4: 123 Switch, Spacebar, Punctuation, Carriage Return Send ── */}
      <View style={styles.row}>
        {/* Numbers / Letters Mode Switcher */}
        <TouchableOpacity
          onPress={() => {
            playTypewriterSound('key');
            setIsSymbolMode(!isSymbolMode);
          }}
          activeOpacity={0.7}
          style={[styles.keyOuter, styles.modeKey]}
        >
          <View style={styles.keyRim}>
            <View style={styles.keyCenter}>
              <AppText style={styles.modeKeyText}>
                {isSymbolMode ? 'ABC' : '?123'}
              </AppText>
            </View>
          </View>
        </TouchableOpacity>

        {/* Period Key */}
        <TypewriterKey label="." onPress={() => handleChar('.')} />

        {/* Spacebar: Vintage Wooden/Metal Platen Bar */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={handleSpace}
          style={styles.spacebarOuter}
        >
          <View style={styles.spacebarInner}>
            <View style={styles.spacebarDecoLine} />
          </View>
        </TouchableOpacity>

        {/* Comma Key */}
        <TypewriterKey label="," onPress={() => handleChar(',')} />

        {/* Vintage Carriage Return / Send Key */}
        <TouchableOpacity
          onPress={handleSendPress}
          activeOpacity={0.8}
          disabled={!canSend}
          style={[
            styles.keyOuter,
            styles.returnKey,
            !canSend && styles.returnKeyDisabled,
          ]}
        >
          <View style={[styles.keyRim, { borderColor: canSend ? '#E09518' : '#3E3730' }]}>
            <View
              style={[
                styles.keyCenter,
                { backgroundColor: canSend ? Colors.primary : '#2B2622' },
              ]}
            >
              <Ionicons
                name="return-down-back"
                size={18}
                color={canSend ? '#FFFFFF' : '#6A635B'}
              />
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const KEY_W = Math.floor((SCREEN_W - 32) / 10) - 2;

const styles = StyleSheet.create({
  keyboardContainer: {
    backgroundColor: '#1E1B18', // Deep antique typewriter cast iron body
    borderTopWidth: 2,
    borderTopColor: '#36302A',
    paddingTop: Spacing[2],
    paddingBottom: Platform.OS === 'ios' ? 24 : Spacing[4],
    paddingHorizontal: 8,
    gap: 7,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#292420',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#4A4137',
  },
  brandTitle: {
    fontFamily: FontFamily.editorial,
    fontSize: FontSize.xs,
    color: '#C5A059', // Antique stamped brass gold
    letterSpacing: 1.2,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#292420',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3D362E',
  },
  topPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#292420',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#3D362E',
  },
  topPillText: {
    color: '#DCD4C7',
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3.5,
  },

  // ── Circular Vintage Mechanical Keycap ───
  keyOuter: {
    width: KEY_W,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyRim: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    backgroundColor: '#191715',
    borderWidth: 1.5,
    borderColor: '#52493F', // Polished vintage metal rim
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },
  keyCenter: {
    width: '84%',
    height: '84%',
    borderRadius: 20,
    backgroundColor: '#2B2622', // Dark baked enamel key center
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontFamily: FontFamily.editorial,
    fontSize: 15,
    color: '#EDE6DA', // Stamped warm ivory
  },

  specialKey: {
    width: KEY_W * 1.35,
  },
  shiftActive: {
    transform: [{ scale: 0.96 }],
  },
  modeKey: {
    width: KEY_W * 1.3,
  },
  modeKeyText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#C5A059',
  },

  // ── Wide Vintage Spacebar ───
  spacebarOuter: {
    flex: 1,
    height: 44,
    marginHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacebarInner: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.lg,
    backgroundColor: '#25201C',
    borderWidth: 1.5,
    borderColor: '#52493F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },
  spacebarDecoLine: {
    width: 48,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#52493F',
  },

  returnKey: {
    width: KEY_W * 1.35,
  },
  returnKeyDisabled: {
    opacity: 0.5,
  },
});
