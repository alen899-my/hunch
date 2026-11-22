/**
 * HUNCH DESIGN SYSTEM — Single source of truth for all design tokens.
 * Edit here to change the entire app look and feel.
 */

// ─── Colors ───────────────────────────────────────────────────────────────────
export const Colors = {
  // Brand
  primary: '#F5A623',       // Amber — main CTA, active state
  primaryDark: '#E09518',   // Pressed amber
  primaryLight: '#FDF3E0',  // Amber tint — backgrounds, chips
  primaryText: '#7A4C00',   // Text on amber backgrounds

  // Neutrals
  background: '#FAF8F5',    // Warm cream — screen background
  surface: '#FFFFFF',       // Cards, inputs, modals
  surfaceAlt: '#F3F1EE',    // Subtle section background

  // Text
  text: '#1A1A1A',          // Primary headings / body
  textSecondary: '#6B6B6B', // Labels, secondary body
  textMuted: '#A8A8A8',     // Placeholders, disabled
  textOnPrimary: '#FFFFFF', // Text on primary button

  // Borders
  border: '#EBEBEB',
  borderFocus: '#F5A623',

  // Semantic
  success: '#5B9E5F',
  successLight: '#EDF5ED',
  error: '#E05252',
  errorLight: '#FDEAEA',
  warning: '#F5A623',
  info: '#5B8DB8',

  // Tag palette (chips / badges)
  tagPink: '#F7E8E8',
  tagPinkText: '#C4675A',
  tagPurple: '#EDE8F7',
  tagPurpleText: '#6E5AAB',
  tagGreen: '#E8F3E8',
  tagGreenText: '#4A8B4A',
  tagAmber: '#FDF3E0',
  tagAmberText: '#7A4C00',
  tagBlue: '#E8EFF8',
  tagBlueText: '#3D6B9E',

  // Emotions
  emotionHappy: '#F5A623',
  emotionSad: '#6B3E3E',
  emotionCalm: '#7A9A5B',
  emotionAnxious: '#8A8A8A',

  // Overlay
  overlay: 'rgba(0,0,0,0.4)',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const FontFamily = {
  black:        'Outfit_800ExtraBold',
  bold:         'Outfit_700Bold',
  semiBold:     'Outfit_600SemiBold',
  medium:       'Outfit_500Medium',
  regular:      'Outfit_400Regular',
  light:        'Outfit_300Light',
  editorial:    'Fraunces_700Bold',
  editorialSemi:'Fraunces_600SemiBold',
  handwriting:  'PatrickHand_400Regular',
} as const;

export const FontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 44,
} as const;

export const LineHeight = {
  tight:  1.2,
  snug:   1.35,
  normal: 1.5,
  loose:  1.7,
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const Spacing = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  7:  28,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────
export const Radius = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 24,
  '3xl': 32,
  full: 999,
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────
export const Shadow = {
  none: {},
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

// ─── Component Sizes ─────────────────────────────────────────────────────────
export const Size = {
  inputHeight: 52,
  buttonHeightSm: 36,
  buttonHeightMd: 48,
  buttonHeightLg: 56,
  avatarSm: 32,
  avatarMd: 44,
  avatarLg: 64,
  avatarXl: 96,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  bottomTabHeight: 70,
} as const;
