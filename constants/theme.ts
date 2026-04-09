import { Platform } from 'react-native';

// Rétrocompatibilité avec les composants existants
export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#7C3AED',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#7C3AED',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#fff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const PALETTE = {
  // Primaires
  purple:      '#7C3AED',
  purpleDark:  '#5B21B6',
  purpleLight: '#EDE9FE',
  blue:        '#2563EB',
  blueDark:    '#1D4ED8',
  blueLight:   '#DBEAFE',
  teal:        '#0891B2',
  tealDark:    '#0E7490',
  tealLight:   '#CFFAFE',
  amber:       '#D97706',
  amberDark:   '#B45309',
  amberLight:  '#FEF3C7',
  green:       '#059669',
  greenLight:  '#D1FAE5',
  red:         '#DC2626',
  redLight:    '#FEE2E2',
  pink:        '#DB2777',
  coral:       '#F97316',

  // Neutres
  white:    '#FFFFFF',
  offWhite: '#F9FAFB',
  gray100:  '#F3F4F6',
  gray200:  '#E5E7EB',
  gray400:  '#9CA3AF',
  gray600:  '#4B5563',
  dark:     '#111827',
};

// Couleur de fond par phase
export const PHASE_BG: Record<string, string> = {
  setup:  PALETTE.purple,
  clue:   PALETTE.blue,
  guess:  PALETTE.teal,
  reveal: PALETTE.amber,
  end:    PALETTE.purple,
};

// Couleurs des avatars joueurs
export const PLAYER_COLORS = [
  PALETTE.purple,
  PALETTE.blue,
  PALETTE.teal,
  PALETTE.coral,
  PALETTE.pink,
];
