/**
 * Screen 1 (§12): Home / Start drive. Full-screen map with an Uber-style sheet:
 * "Where to?" opens Google Maps directions *before* the drive (EduDriver has no
 * turn-by-turn), then the driving lock and passenger options (§4) and Drive.
 */
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useMapGps } from '../../trip';
import { Button } from '../components/Button';
import { MapCanvas } from '../components/MapCanvas';
import { ToggleRow } from '../components/primitives';
import { TestDriveBadge } from '../components/TestDriveBadge';
import { directionsUrl } from '../lib/links';
import type { ScreenProps } from '../navigation';
import { colors, font, radius, SAFE_BOTTOM, SAFE_TOP, shadow, space } from '../theme';

export function StartDriveScreen({ modules, navigate, settings }: ScreenProps) {
  const { fix, error } = useMapGps(modules.trip);
  const [lockEnabled, setLockEnabled] = useState(settings.lockByDefault);
  const [passenger, setPassenger] = useState(false);
  const [destination, setDestination] = useState('');

  const here = fix ? { latitude: fix.lat, longitude: fix.lon } : null;

  const start = () => {
    void modules.trip.start({ lockEnabled, passenger });
    navigate({ name: 'driving' });
  };

  return (
    <View style={styles.root}>
      <MapCanvas style={StyleSheet.absoluteFill} follow={here} car={here} />

      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>EduDriver</Text>
          {settings.demoMode ? <TestDriveBadge /> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigate({ name: 'settings' })}
          style={styles.chip}
        >
          <Text style={styles.chipText}>Settings</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          {error ? <Text style={styles.error}>Location: {error}</Text> : null}

          <View style={styles.whereRow}>
            <TextInput
              style={styles.where}
              placeholder="Where to?"
              placeholderTextColor={colors.textMuted}
              value={destination}
              onChangeText={setDestination}
              returnKeyType="go"
              onSubmitEditing={() => void Linking.openURL(directionsUrl(destination))}
            />
            <Button
              title="Directions"
              variant="secondary"
              onPress={() => void Linking.openURL(directionsUrl(destination))}
            />
          </View>
          <Text style={styles.hint}>
            Opens Google Maps. Start directions there, then come back and tap Drive. Voice
            directions keep playing while you drive.
          </Text>

          <ToggleRow
            label="Driving lock"
            hint="Full-screen driving mode. Emergency and directions stay available."
            value={lockEnabled}
            onChange={setLockEnabled}
          />
          <ToggleRow
            label="I'm a passenger"
            hint="Records the trip without scoring it."
            value={passenger}
            onChange={setPassenger}
          />

          <Button title="Drive" large onPress={start} style={styles.drive} />

          <View style={styles.links}>
            <Button
              title="Past drives"
              variant="secondary"
              onPress={() => navigate({ name: 'list' })}
              style={styles.link}
            />
            <Button
              title="Progress"
              variant="secondary"
              onPress={() => navigate({ name: 'progress' })}
              style={styles.link}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceAlt },
  topBar: {
    position: 'absolute',
    top: SAFE_TOP,
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  brand: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  chip: {
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    ...shadow,
  },
  chipText: { fontSize: font.body, fontWeight: '600', color: colors.text },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: SAFE_BOTTOM + space.sm,
    ...shadow,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: space.md,
  },
  error: { color: colors.harsh, fontSize: font.small, marginBottom: space.sm },
  whereRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  where: {
    flex: 1,
    minHeight: 52,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontSize: font.body,
    fontWeight: '600',
    color: colors.text,
  },
  hint: {
    fontSize: font.small,
    color: colors.textMuted,
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  drive: { marginTop: space.md },
  links: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  link: { flex: 1 },
});
