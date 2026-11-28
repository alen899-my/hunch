/**
 * HUNCH DESIGN SYSTEM — Single source of truth for all design tokens.
 * Edit here to change the entire app look and feel.
 */

// ─── Colors ───────────────────────────────────────────────────────────────────
export const Colors = {
  // Brand — Calm Botanical Sage Green (edit here to retheme the whole app)
  primary: '#4C7C59',       // Calm sage green — main CTA, Today card, active state
  primaryDark: '#355C40',   // Deep moss green — pressed state & active icons
  primaryLight: '#E6F0E8',  // Soft mist green tint — badges, chips, highlights
  primaryText: '#24422D',   // Rich forest text on soft green backgrounds
  primarySoft: '#F4F8F5',   // Feather-light green tint — subtle strips & chip bg
  primaryBorder: '#C7DBC9', // Muted sage border — subtle chip/card outlines
  primaryTint16: 'rgba(76, 124, 89, 0.16)', // Mention highlight & subtle accent
  primaryTint25: 'rgba(76, 124, 89, 0.25)', // Selection overlay & glow

  // Neutrals
  background: '#FAF8F5',    // Warm linen cream — screen background
  surface: '#FFFFFF',       // Cards, inputs, modals
  surfaceAlt: '#F3F1EE',    // Subtle section background

  // Text
  text: '#1A1A1A',          // Primary headings / body
  textSecondary: '#6B6B6B', // Labels, secondary body
  textMuted: '#A8A8A8',     // Placeholders, disabled
  textOnPrimary: '#FFFFFF', // Text on primary button

  // Borders
  border: '#EBEBEB',
  borderFocus: '#4C7C59',

  // Semantic
  success: '#4C7C59',
  successLight: '#E6F0E8',
  error: '#E05252',
  errorLight: '#FDEAEA',
  warning: '#D99B38',
  info: '#5B8DB8',

  // Tag palette (chips / badges)
  tagPink: '#F7E8E8',
  tagPinkText: '#C4675A',
  tagPurple: '#EDE8F7',
  tagPurpleText: '#6E5AAB',
  tagGreen: '#E6F0E8',
  tagGreenText: '#355C40',
  tagAmber: '#FDF3E0',
  tagAmberText: '#7A4C00',
  tagBlue: '#E8EFF8',
  tagBlueText: '#3D6B9E',

  // Emotions
  emotionHappy: '#E2A03F',
  emotionSad: '#5B87B0',
  emotionCalm: '#4C7C59',
  emotionAnxious: '#75736F',

  // Overlay
  overlay: 'rgba(0,0,0,0.4)',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export type ThemeColors = {
  -readonly [K in keyof typeof Colors]: string;
};

export interface MoodThemeAccent {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryText: string;
  primarySoft: string;
  primaryBorder: string;
  primaryTint16: string;
  primaryTint25: string;
  background: string;
}

export const MOOD_THEME_PALETTES: Record<string, MoodThemeAccent> = {
  calm: {
    primary: '#4C7C59',
    primaryDark: '#355C40',
    primaryLight: '#E6F0E8',
    primaryText: '#24422D',
    primarySoft: '#F4F8F5',
    primaryBorder: '#C7DBC9',
    primaryTint16: 'rgba(76, 124, 89, 0.16)',
    primaryTint25: 'rgba(76, 124, 89, 0.25)',
    background: '#F8FAF8',
  },
  happy: {
    primary: '#D98C1A',
    primaryDark: '#A86808',
    primaryLight: '#FDF2DC',
    primaryText: '#613B00',
    primarySoft: '#FCF8EE',
    primaryBorder: '#EAD5AC',
    primaryTint16: 'rgba(217, 140, 26, 0.16)',
    primaryTint25: 'rgba(217, 140, 26, 0.25)',
    background: '#FCFBF7',
  },
  grateful: {
    primary: '#C87236',
    primaryDark: '#9A511F',
    primaryLight: '#FBECE1',
    primaryText: '#5E2E0C',
    primarySoft: '#FCF6F0',
    primaryBorder: '#EACBB5',
    primaryTint16: 'rgba(200, 114, 54, 0.16)',
    primaryTint25: 'rgba(200, 114, 54, 0.25)',
    background: '#FCF9F6',
  },
  excited: {
    primary: '#D95D39',
    primaryDark: '#AD4122',
    primaryLight: '#FCEAE4',
    primaryText: '#68210E',
    primarySoft: '#FDF5F2',
    primaryBorder: '#EFC6B9',
    primaryTint16: 'rgba(217, 93, 57, 0.16)',
    primaryTint25: 'rgba(217, 93, 57, 0.25)',
    background: '#FCF9F8',
  },
  loved: {
    primary: '#C9516E',
    primaryDark: '#9C3750',
    primaryLight: '#FBE9EE',
    primaryText: '#631A2D',
    primarySoft: '#FDF4F6',
    primaryBorder: '#ECC3CD',
    primaryTint16: 'rgba(201, 81, 110, 0.16)',
    primaryTint25: 'rgba(201, 81, 110, 0.25)',
    background: '#FCF8F9',
  },
  tired: {
    primary: '#646B85',
    primaryDark: '#484E64',
    primaryLight: '#ECEEF4',
    primaryText: '#2D3245',
    primarySoft: '#F5F6F9',
    primaryBorder: '#CCD1DF',
    primaryTint16: 'rgba(100, 107, 133, 0.16)',
    primaryTint25: 'rgba(100, 107, 133, 0.25)',
    background: '#F8F9FB',
  },
  sad: {
    primary: '#4B78A3',
    primaryDark: '#33587B',
    primaryLight: '#E7F0F8',
    primaryText: '#1E3954',
    primarySoft: '#F3F7FB',
    primaryBorder: '#C3D7EA',
    primaryTint16: 'rgba(75, 120, 163, 0.16)',
    primaryTint25: 'rgba(75, 120, 163, 0.25)',
    background: '#F7FAFC',
  },
  anxious: {
    primary: '#6E6C67',
    primaryDark: '#4F4D49',
    primaryLight: '#EEEDE9',
    primaryText: '#33322F',
    primarySoft: '#F6F5F3',
    primaryBorder: '#D4D2CB',
    primaryTint16: 'rgba(110, 108, 103, 0.16)',
    primaryTint25: 'rgba(110, 108, 103, 0.25)',
    background: '#F9F8F6',
  },
  angry: {
    primary: '#C44B45',
    primaryDark: '#99322D',
    primaryLight: '#FCEAE9',
    primaryText: '#611916',
    primarySoft: '#FDF4F4',
    primaryBorder: '#ECC1BF',
    primaryTint16: 'rgba(196, 75, 69, 0.16)',
    primaryTint25: 'rgba(196, 75, 69, 0.25)',
    background: '#FCF8F8',
  },
};

export function buildColorsForMood(mood?: string | null): ThemeColors {
  const accent = (mood && MOOD_THEME_PALETTES[mood]) || MOOD_THEME_PALETTES.calm;
  return {
    ...Colors,
    ...accent,
    borderFocus: accent.primary,
    success: accent.primary,
    successLight: accent.primaryLight,
    tagGreen: accent.primaryLight,
    tagGreenText: accent.primaryDark,
  };
}

// ─── Typography ───────────────────────────────────────────────────────────────
// Clean neo-grotesque product sans (Uber Move inspired) — edit here to retheme all text app-wide
const PRIMARY_FONT = {
  extraBold: 'PlusJakartaSans_800ExtraBold',
  bold:      'PlusJakartaSans_700Bold',
  semiBold:  'PlusJakartaSans_600SemiBold',
  medium:    'PlusJakartaSans_500Medium',
  regular:   'PlusJakartaSans_400Regular',
  light:     'PlusJakartaSans_300Light',
  italic:    'PlusJakartaSans_400Regular_Italic',
} as const;

export const FontFamily = {
  black:        PRIMARY_FONT.extraBold,
  bold:         PRIMARY_FONT.bold,
  semiBold:     PRIMARY_FONT.semiBold,
  medium:       PRIMARY_FONT.medium,
  regular:      PRIMARY_FONT.regular,
  light:        PRIMARY_FONT.light,
  editorial:    PRIMARY_FONT.bold,
  editorialSemi:PRIMARY_FONT.semiBold,
  handwriting:  PRIMARY_FONT.italic,
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
