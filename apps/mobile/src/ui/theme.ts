/**
 * Design tokens for the whole UI. Layout: Google Maps (map-first,
 * floating cards, calm dark driving mode) + Uber (trip cards, receipt-style
 * debrief). Look: flat teal palette. No gradients, blur, glow or soft
 * shadows; depth comes only from the "lip", a solid bottom border one shade
 * darker than the surface above it.
 *
 * Change the look of the app here first; screens and components only read
 * these tokens.
 */
import { Platform, StatusBar } from 'react-native';

export const colors = {
  // Brand palette: teal is the main color, used as real surfaces. Coral is
  // rare and always means streaks or harsh events. Amber is coach-tier events.
  teal50: '#EAF7F4',
  teal100: '#CDEFE8',
  teal200: '#9FDDD3',
  teal400: '#3DB8AB',
  teal500: '#1FA39A',
  teal700: '#137A73',
  teal900: '#0B3B38',
  coral100: '#FFE6E2',
  coral500: '#FF7A6B',
  coral700: '#D9574A',
  amber100: '#FFF1D6',
  amber500: '#FFB547',
  amber700: '#B7791F',

  /** Primary actions (buttons, active states, spinners) and their darker lip. */
  primary: '#1FA39A',
  primaryLip: '#137A73',
  dangerLip: '#D9574A',
  /** Text and icons on teal / coral surfaces. */
  onColor: '#FFFFFF',

  // Pure black/white: road signs (SpeedLimitSign, StopSign) only
  black: '#000000',
  white: '#FFFFFF',

  bg: '#F1FAF8',
  surface: '#FFFFFF',
  surfaceAlt: '#EAF7F4',
  border: '#D7E7E3',
  text: '#16332F',
  textMuted: '#4F6B67',
  textOnDark: '#E8F5F2',
  textOnDarkMuted: '#9FDDD3',

  // Route line and "you are here"
  route: '#1FA39A',
  location: '#1FA39A',

  // Meaning only: event severity (tier) and success states
  good: '#137A73',
  /** Background for success chips (coach strengths). */
  goodSoft: '#EAF7F4',
  coach: '#FFB547',
  harsh: '#FF7A6B',

  // Driving mode (always dark)
  driveBg: '#0B1F1D',
  drivePanel: '#12302D',
  driveBorder: '#0B3B38',

  disabled: '#D7E7E3',
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

/** Animation timings in ms (components/motion.tsx). */
export const motion = {
  fast: 160,
  normal: 280,
  /** Screen-to-screen transition. */
  screen: 320,
  slow: 480,
  /** Delay between items in a list entrance. */
  stagger: 70,
  /** Cap so long lists don't wait forever for the last item. */
  maxStaggerItems: 8,
} as const;

/** Minimum touch target in driving mode (glove/car friendly). */
export const DRIVE_BUTTON_HEIGHT = 64;

/** Space above content so it clears the status bar / notch (no safe-area library). */
export const SAFE_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 54;
export const SAFE_BOTTOM = Platform.OS === 'ios' ? 28 : 12;

/** The flat "lip" under chunky surfaces (buttons, hero cards). */
export const lip = { rest: 4, pressed: 2 } as const;

/** Hairline and outline widths. */
export const stroke = { hairline: 1, outline: 2 } as const;

/** Card edge: hairline outline plus the lip. Replaces the old soft shadow. */
export const edge = {
  borderWidth: stroke.hairline,
  borderColor: colors.border,
  borderBottomWidth: lip.rest,
} as const;

/** Google Maps style for driving mode (Android; iOS uses userInterfaceStyle), in the drive palette. */
export const mapDarkStyle = [
  { elementType: 'geometry', stylers: [{ color: colors.driveBg }] },
  { elementType: 'labels.text.fill', stylers: [{ color: colors.teal200 }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: colors.driveBg }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: colors.drivePanel }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: colors.teal900 }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: colors.drivePanel }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
