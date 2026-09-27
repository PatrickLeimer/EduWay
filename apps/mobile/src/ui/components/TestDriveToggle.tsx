/**
 * "Test drive" switch (Settings and Dev tools). On = the next drive replays the
 * fixture drive (wiring.ts DEMO_FLAGS), so a presentation works with the phone
 * sitting still. Locked while a trip is running so modules never swap mid-trip.
 */
import { useTripState } from '../../trip';
import type { ScreenProps } from '../navigation';
import { ToggleRow } from './primitives';

export function TestDriveToggle({
  modules,
  settings,
  updateSettings,
}: Pick<ScreenProps, 'modules' | 'settings' | 'updateSettings'>) {
  const { status } = useTripState(modules.trip);
  const busy = status !== 'idle';
  return (
    <ToggleRow
      label="Test drive (simulated)"
      hint={
        busy
          ? 'Finish the current drive to change this.'
          : 'Replays a recorded 3-minute drive with events, so you can demo without moving. Voice alerts and the debrief are real.'
      }
      value={settings.demoMode}
      onChange={(v) => updateSettings({ demoMode: v })}
      disabled={busy}
    />
  );
}
