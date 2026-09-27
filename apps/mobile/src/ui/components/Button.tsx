/**
 * Buttons: a solid face on a darker "lip" (a 4px bottom border). On press the
 * face moves down 2px and the lip shrinks to 2px, so the button looks pushed
 * in. No shadows, no gradients.
 */
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, DRIVE_BUTTON_HEIGHT, font, lip, radius, space, stroke } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'onDark';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** Driving-mode size (≥ 64 pt tall, larger text). */
  large?: boolean;
  /** Layout only (flex, margins); the look comes from `variant`. */
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  large = false,
  style,
}: ButtonProps) {
  const height = large ? DRIVE_BUTTON_HEIGHT : 52;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[{ height }, style]}
    >
      {({ pressed }) => {
        // Disabled buttons are flat (no lip) so they read as "not pressable yet".
        const lipWidth = disabled ? 0 : pressed ? lip.pressed : lip.rest;
        const drop = disabled ? lip.rest : lip.rest - lipWidth;
        return (
          <View
            style={[
              styles.face,
              styles[variant],
              disabled && (variant === 'onDark' ? styles.disabledDark : styles.disabled),
              { height: height - drop, marginTop: drop, borderBottomWidth: lipWidth },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                large && styles.labelLarge,
                variant === 'secondary' ? styles.labelTeal : styles.labelLight,
                disabled && variant !== 'onDark' && styles.labelDisabled,
              ]}
            >
              {title}
            </Text>
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    borderRadius: radius.md,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary, borderBottomColor: colors.primaryLip },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopWidth: stroke.outline,
    borderLeftWidth: stroke.outline,
    borderRightWidth: stroke.outline,
  },
  danger: { backgroundColor: colors.harsh, borderBottomColor: colors.dangerLip },
  onDark: { backgroundColor: colors.drivePanel, borderBottomColor: colors.driveBorder },
  disabled: { backgroundColor: colors.disabled, borderColor: colors.disabled },
  disabledDark: { opacity: 0.5 },
  label: { fontSize: font.body, fontWeight: '700', textAlign: 'center' },
  labelLarge: { fontSize: font.driveMin },
  labelLight: { color: colors.onColor },
  labelTeal: { color: colors.good },
  labelDisabled: { color: colors.textMuted },
});
