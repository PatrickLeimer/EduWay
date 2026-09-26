/**
 * Dev menu → "Drive recorder". Records a test drive to a file on the phone for
 * threshold tuning and validation. Placeholder UI (plain components only); the
 * logic lives in src/recorder. Full instructions: docs/drive-recording.md.
 */
import { MPS_TO_MPH } from '@edudriver/shared';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Text, View } from 'react-native';

import {
  MARKERS,
  MARKER_TYPES,
  SEGMENTS,
  clock,
  createPhoneRecording,
  deleteRecording,
  listRecordings,
  shareRecording,
  type Mount,
  type PhoneRecording,
  type RecorderStatus,
  type SavedRecording,
} from '../../recorder';
import type { ScreenProps } from '../navigation';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function safeList(): SavedRecording[] {
  try {
    return listRecordings();
  } catch {
    return [];
  }
}

const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;

export function DriveRecorderScreen(_props: ScreenProps) {
  useKeepAwake();
  const rec = useRef<PhoneRecording | null>(null);
  const [mount, setMount] = useState<Mount>('mounted');
  const [status, setStatus] = useState<RecorderStatus | null>(null);
  const [saved, setSaved] = useState<SavedRecording[]>(safeList);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      if (rec.current) setStatus(rec.current.recorder.getStatus());
    }, 500);
    return () => {
      clearInterval(id);
      // Leaving this screen stops and saves the recording.
      rec.current?.stop();
    };
  }, []);

  const recording = status?.state === 'starting' || status?.state === 'recording';

  const start = useCallback(async () => {
    setMessage(null);
    try {
      const r = createPhoneRecording();
      rec.current = r;
      setStatus(r.recorder.getStatus());
      await r.start(mount);
      setStatus(r.recorder.getStatus());
    } catch (e) {
      setMessage(`Could not start: ${errorText(e)}`);
    }
  }, [mount]);

  const stop = useCallback(() => {
    const r = rec.current;
    if (!r) return;
    r.stop();
    setStatus(r.recorder.getStatus());
    setMessage(`Saved ${r.fileName}. Tap Share below to send it to your laptop.`);
    setSaved(safeList());
  }, []);

  const share = useCallback(async (s: SavedRecording) => {
    try {
      await shareRecording(s);
    } catch (e) {
      setMessage(`Share failed: ${errorText(e)}`);
    }
  }, []);

  const remove = useCallback((s: SavedRecording) => {
    Alert.alert('Delete recording?', `${s.name} will be gone for good.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteRecording(s);
          } catch (e) {
            setMessage(`Delete failed: ${errorText(e)}`);
          }
          setSaved(safeList());
        },
      },
    ]);
  }, []);

  const mark = (m: (typeof MARKER_TYPES)[number]) => {
    rec.current?.recorder.mark(m);
    setStatus(rec.current?.recorder.getStatus() ?? null);
  };

  const fix = status?.lastFix ?? null;
  const road = status?.road ?? null;
  const match = status?.roadMatch ?? null;

  return (
    <View>
      <Text>DRIVE RECORDER (dev only)</Text>
      <Text>
        Records raw motion, GPS, road data, detected events and your markers to a file on this
        phone. Nothing is uploaded. Full guide: docs/drive-recording.md
      </Text>
      {message && <Text>{message}</Text>}

      {!recording && (
        <View>
          <Text> </Text>
          <Text>BEFORE YOU START</Text>
          <Text>1. Mount the phone firmly where the PASSENGER can reach it (dash or vent</Text>
          <Text> mount on the passenger side). The driver never touches it.</Text>
          <Text>2. The passenger taps markers with one light finger tap. No mount? Set</Text>
          <Text> Mount to &quot;loose&quot; (the data is less useful for tuning).</Text>
          <Text>3. Tap Start. Allow Motion and Location if asked.</Text>
          <Text>4. Wait until GPS accuracy is under 20 m and Road shows ways before driving.</Text>
          <Text>5. Keep this screen open the whole drive. Leaving it stops the recording.</Text>
          <Text> </Text>
          <Button
            title={`Mount: ${mount} (tap to change)`}
            onPress={() => setMount((m) => (m === 'mounted' ? 'loose' : 'mounted'))}
          />
          <Button title="Start recording" onPress={() => void start()} />
        </View>
      )}

      {status && status.state !== 'idle' && (
        <View>
          <Text> </Text>
          <Text>
            {status.state.toUpperCase()} {clock(status.elapsedS * 1000)} · file{' '}
            {mb(status.bytesWritten)}
          </Text>
          {status.error && <Text>ERROR: {status.error}</Text>}
          <Text>
            Motion: {status.samples} samples, {status.motionHz.toFixed(0)} Hz
            {recording && status.motionHz > 0 && status.motionHz < 40 ? '  ← LOW, expect ~50' : ''}
            {status.junkPaused ? '  (paused: phone moving)' : ''}
          </Text>
          <Text>
            GPS: {status.gpsFixes} fixes · accuracy{' '}
            {fix?.accuracyM != null ? `${fix.accuracyM.toFixed(0)} m` : '?'}
            {fix?.accuracyM != null && fix.accuracyM > 20 ? '  ← TOO LOW, wait' : ''} · speed{' '}
            {fix?.speedMps != null ? `${(fix.speedMps * MPS_TO_MPH).toFixed(0)} mph` : '?'}
          </Text>
          <Text>
            Road: {road ? `${road.wayCount} ways, ${road.stopSignCount} stop signs` : 'no data yet'}
            {road?.fetching ? ' · fetching…' : ''} · Overpass ok {status.overpassOk}, failed{' '}
            {status.overpassFailed}
          </Text>
          {road?.lastError && <Text>Road error: {road.lastError}</Text>}
          <Text>
            On: {match ? `${match.street ?? '(unnamed)'} · ${match.roadClass ?? '?'}` : 'no match'}
            {match?.limitMph != null ? ` · limit ${match.limitMph} (${match.limitConfidence})` : ''}
          </Text>
          <Text>© OpenStreetMap contributors</Text>
        </View>
      )}

      {recording && (
        <View>
          <Text> </Text>
          <Text>WHERE ARE WE? (tap when the plan moves on)</Text>
          {SEGMENTS.map((s) => (
            <Button
              key={s}
              title={s === status?.segment ? `${s}  ← now` : s}
              onPress={() => {
                rec.current?.recorder.setSegment(s);
                setStatus(rec.current?.recorder.getStatus() ?? null);
              }}
            />
          ))}

          <Text> </Text>
          <Text>MARKERS (passenger: tap right after it happens)</Text>
          <Text>
            Markers: {status?.markers ?? 0}
            {status?.lastMarker ? ` · last: ${MARKERS[status.lastMarker].label}` : ''}
          </Text>
          {MARKER_TYPES.map((m) => (
            <Button key={m} title={MARKERS[m].label} onPress={() => mark(m)} />
          ))}

          <Text> </Text>
          <Button title="Stop and save" onPress={stop} />
        </View>
      )}

      {status && status.events.length > 0 && (
        <View>
          <Text> </Text>
          <Text>DETECTED LIVE (newest first)</Text>
          {status.events.slice(0, 8).map((e, i) => (
            <Text key={i}>
              {clock(e.rt)} {e.event.type} [{e.event.tier}] peak {e.event.peak?.toFixed(1) ?? '-'} ·{' '}
              {e.event.speedMph.toFixed(0)} mph
              {e.road?.street ? ` · ${e.road.street}` : ''}
            </Text>
          ))}
        </View>
      )}

      {!recording && (
        <View>
          <Text> </Text>
          <Text>SAVED RECORDINGS ({saved.length})</Text>
          {saved.length === 0 && <Text>None yet.</Text>}
          {saved.map((s) => (
            <View key={s.name}>
              <Text>
                {s.name} · {mb(s.sizeBytes)}
              </Text>
              <Button title="Share" onPress={() => void share(s)} />
              <Button title="Delete" onPress={() => remove(s)} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
