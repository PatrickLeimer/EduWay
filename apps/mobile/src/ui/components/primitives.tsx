/** Small presentational pieces shared by the light (non-driving) screens. */
import type { ReactNode } from 'react';
import { StyleSheet, Switch, Text, View, type ViewStyle } from 'react-native';

import { colors, font, fonts, lip as lipWidth, radius, space, stroke } from '../theme';

/**
 * White card with a hairline border. `lip` gives it the chunky bottom edge:
 * use it for the one hero card on a screen.
 */
export function Card({
  children,
  lip = false,
  style,
}: {
  children: ReactNode;
  lip?: boolean;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, lip && styles.cardLip, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.muted}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.white}
      />
    </View>
  );
}

/** Required wherever OSM street names or speed limits are shown (§8 "Display"). */
export function OsmCredit({ dark = false }: { dark?: boolean }) {
  return <Text style={[styles.osm, dark && styles.osmDark]}>© OpenStreetMap contributors</Text>;
}

/** Colored dot for event severity (tier). */
export function TierDot({ tier }: { tier: 'coach' | 'harsh' }) {
  return (
    <View
      style={[styles.dot, { backgroundColor: tier === 'harsh' ? colors.harsh : colors.coach }]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: stroke.hairline,
    borderColor: colors.border,
    padding: space.lg,
  },
  cardLip: { borderBottomWidth: lipWidth.rest },
  section: {
    fontSize: font.title,
    fontFamily: fonts.semiBold,
    color: colors.text,
    marginTop: space.xl,
    marginBottom: space.md,
  },
  muted: { fontFamily: fonts.regular, fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  tile: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderBottomWidth: lipWidth.rest,
    borderBottomColor: colors.teal100,
    padding: space.md,
  },
  tileValue: { fontSize: font.title, fontFamily: fonts.semiBold, color: colors.text },
  tileLabel: {
    fontFamily: fonts.regular,
    fontSize: font.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
  toggleText: { flex: 1, paddingRight: space.md },
  toggleLabel: { fontSize: font.body, fontFamily: fonts.semiBold, color: colors.text },
  osm: {
    fontFamily: fonts.regular,
    fontSize: font.tiny,
    color: colors.textMuted,
    marginTop: space.sm,
  },
  osmDark: { color: colors.textOnDarkMuted },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
