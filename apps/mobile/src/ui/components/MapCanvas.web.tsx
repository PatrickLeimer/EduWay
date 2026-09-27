/**
 * Browser build of MapCanvas. react-native-maps does not run on web, so this
 * shows the keyless Google Maps embed centered on the car / route. Route lines
 * and pins are phone-only. Phones use MapCanvas.tsx.
 */
import { createElement, type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { regionFor } from '../lib/geo';
import { colors, font } from '../theme';
import type { MapCanvasProps } from './mapTypes';

const Frame = 'iframe' as unknown as ComponentType<{
  title: string;
  src: string;
  style: { width: string; height: string; borderWidth: number; pointerEvents?: string };
}>;

export function MapCanvas({
  style,
  car,
  follow,
  fitTo,
  route,
  interactive = true,
}: MapCanvasProps) {
  const center = car ?? follow ?? regionFor(fitTo ?? route ?? []);
  if (!center) {
    return (
      <View style={[styles.empty, style]}>
        <Text style={styles.emptyText}>Waiting for GPS…</Text>
      </View>
    );
  }
  const q = `${center.latitude},${center.longitude}`;
  return (
    <View style={style}>
      {createElement(Frame, {
        title: 'Google Maps',
        src: `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`,
        style: {
          width: '100%',
          height: '100%',
          borderWidth: 0,
          pointerEvents: interactive ? 'auto' : 'none',
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, fontSize: font.body },
});
