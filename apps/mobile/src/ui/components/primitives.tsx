/** Small presentational pieces shared by the light (non-driving) screens. */
import type { ReactNode } from 'react';
import { StyleSheet, Switch, Text, View, type ViewStyle } from 'react-native';

import { colors, font, radius, shadow, space } from '../theme';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
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
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
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
        trackColor={{ true: colors.black, false: colors.border }}
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
    borderRadius: radius.lg,
    padding: space.lg,
    ...shadow,
  },
  section: {
    fontSize: font.title,
    fontWeight: '700',
    color: colors.text,
    marginTop: space.xl,
    marginBottom: space.md,
  },
  muted: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  tile: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: space.md,
  },
  tileValue: { fontSize: font.title, fontWeight: '700', color: colors.text },
  tileLabel: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
  toggleText: { flex: 1, paddingRight: space.md },
  toggleLabel: { fontSize: font.body, fontWeight: '600', color: colors.text },
  osm: { fontSize: font.tiny, color: colors.textMuted, marginTop: space.sm },
  osmDark: { color: colors.textOnDarkMuted },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
