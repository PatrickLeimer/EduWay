/**
 * Design tokens for the whole UI. Style direction: Google Maps (map-first,
 * floating cards, calm dark driving mode) + Uber (black/white base, big black
 * primary button, trip cards, receipt-style debrief). See docs/ui-prompt.md.
 *
 * Change the look of the app here first; screens and components only read
 * these tokens.
 */
import { Platform, StatusBar } from 'react-native';

export const colors = {
  // Uber-style neutral base
  black: '#000000',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F3F3',
  border: '#E2E2E2',
  text: '#000000',
  textMuted: '#6B6B6B',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#A6A6A6',

  // Google Maps blue: route line and "you are here" only
  route: '#1A73E8',
  location: '#1A73E8',

  // Meaning only: event severity (tier) and success states
  good: '#1E8E3E',
  coach: '#F9AB00',
  harsh: '#D93025',

  // Driving mode (always dark)
  driveBg: '#0B0F14',
  drivePanel: '#161B22',
  driveBorder: '#2A313C',

  disabled: '#BDBDBD',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const font = {
  /** Driving-mode speed number. Readable at a glance (§16). */
  speed: 96,
  display: 34,
  title: 22,
  body: 16,
  small: 13,
  tiny: 11,
  /** Minimum text size anywhere in driving mode. */
  driveMin: 20,
} as const;

/** Minimum touch target in driving mode (glove/car friendly). */
export const DRIVE_BUTTON_HEIGHT = 64;

/** Space above content so it clears the status bar / notch (no safe-area library). */
export const SAFE_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 54;
export const SAFE_BOTTOM = Platform.OS === 'ios' ? 28 : 12;

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.15,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
} as const;
