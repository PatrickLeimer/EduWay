/**
 * Screen 6 (§12): Settings. Driving lock default (§4) and Test drive (demo).
 * Settings live in memory
 * (Root state) until the team picks a storage approach.
 * Delete trip (§16 [Proposed]) is not here: there is no delete endpoint in the
 * ApiClient contract yet.
 */
import { Button } from '../components/Button';
import { Card, Muted, SectionTitle, ToggleRow } from '../components/primitives';
import { Screen } from '../components/Screen';
import { TestDriveToggle } from '../components/TestDriveToggle';
import type { ScreenProps } from '../navigation';

export function SettingsScreen({ modules, navigate, settings, updateSettings }: ScreenProps) {
  return (
    <Screen title="Settings" onBack={() => navigate({ name: 'start' })} backLabel="Home">
      <Card>
        <ToggleRow
          label="Driving lock on by default"
          hint="Full-screen driving mode. Emergency calls and directions always stay available."
          value={settings.lockByDefault}
          onChange={(v) => updateSettings({ lockByDefault: v })}
        />
      </Card>

      <SectionTitle>Presentation</SectionTitle>
      <Card>
        <TestDriveToggle modules={modules} settings={settings} updateSettings={updateSettings} />
      </Card>

      <SectionTitle>About</SectionTitle>
      <Muted>
        EduWay coaches you with short voice alerts during the drive and a debrief after it. Motion
        sensor data never leaves your phone; only your GPS route is saved for the replay.
      </Muted>
      <Muted>Scores are a coaching tool, not a certification of safety.</Muted>

      <SectionTitle>Developer</SectionTitle>
      <Button
        title="Developer tools"
        variant="secondary"
        onPress={() => navigate({ name: 'dev' })}
      />
    </Screen>
  );
}
