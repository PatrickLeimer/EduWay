/** Buttons. Uber-style: primary is solid black, secondary is light gray. */
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors, DRIVE_BUTTON_HEIGHT, font, radius, space } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'onDark';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** Driving-mode size (≥ 64 pt tall, larger text). */
  large?: boolean;
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        large && styles.large,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          large && styles.labelLarge,
          variant === 'secondary' ? styles.labelDark : styles.labelLight,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  large: { minHeight: DRIVE_BUTTON_HEIGHT, borderRadius: radius.lg },
  primary: { backgroundColor: colors.black },
  secondary: { backgroundColor: colors.surfaceAlt },
  danger: { backgroundColor: colors.harsh },
  onDark: { backgroundColor: colors.drivePanel, borderWidth: 1, borderColor: colors.driveBorder },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  label: { fontSize: font.body, fontWeight: '600', textAlign: 'center' },
  labelLarge: { fontSize: font.driveMin },
  labelLight: { color: colors.white },
  labelDark: { color: colors.text },
});
