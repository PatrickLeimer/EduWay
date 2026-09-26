/**
 * App shell: state-based navigation between screens (see navigation.ts).
 * Product screens (and the dev menu) draw their own full-screen layout; the
 * WS1–WS4 debug screens keep the plain scrolling wrapper they were built for.
 */
import { useCallback, useState } from 'react';
import { Button, ScrollView, StyleSheet, View } from 'react-native';

import { getDemoModules, type AppModules } from '../wiring';

import { DriveRecorderScreen } from './dev/DriveRecorderScreen';
import { Ws1Debug } from './dev/Ws1Debug';
import { Ws2Debug } from './dev/Ws2Debug';
import { Ws3Debug } from './dev/Ws3Debug';
import { Ws4Debug } from './dev/Ws4Debug';
import { DEFAULT_SETTINGS, type AppSettings, type Route, type ScreenProps } from './navigation';
import { DevMenuScreen } from './screens/DevMenuScreen';
import { DrivingScreen } from './screens/DrivingScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { ReplayScreen } from './screens/ReplayScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StartDriveScreen } from './screens/StartDriveScreen';
import { TripEndedScreen } from './screens/TripEndedScreen';
import { TripListScreen } from './screens/TripListScreen';
import { TripResultScreen } from './screens/TripResultScreen';
import { colors, SAFE_TOP } from './theme';

function renderRoute(route: Route, props: ScreenProps) {
  switch (route.name) {
    case 'start':
      return <StartDriveScreen {...props} />;
    case 'driving':
      return <DrivingScreen {...props} />;
    case 'ended':
      return <TripEndedScreen {...props} />;
    case 'result':
      return <TripResultScreen {...props} tripId={route.tripId} />;
    case 'replay':
      return <ReplayScreen {...props} tripId={route.tripId} />;
    case 'list':
      return <TripListScreen {...props} />;
    case 'progress':
      return <ProgressScreen {...props} />;
    case 'settings':
      return <SettingsScreen {...props} />;
    case 'dev':
      return <DevMenuScreen {...props} />;
    case 'ws1':
      return <Ws1Debug {...props} />;
    case 'ws2':
      return <Ws2Debug {...props} />;
    case 'ws3':
      return <Ws3Debug {...props} />;
    case 'ws4':
      return <Ws4Debug {...props} />;
    case 'recorder':
      return <DriveRecorderScreen {...props} />;
  }
}

/** WS1–WS4 debug screens: plain ScrollView + back button, as before the UI phase. */
const DEV_ROUTES: Route['name'][] = ['ws1', 'ws2', 'ws3', 'ws4', 'recorder'];

export function Root({ modules }: { modules: AppModules }) {
  const [route, setRoute] = useState<Route>({ name: 'start' });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const navigate = useCallback((r: Route) => setRoute(r), []);
  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => setSettings((s) => ({ ...s, ...patch })),
    [],
  );
  // Test drive swaps in the simulated modules; Settings only allows it while no trip is running.
  const active = settings.demoMode ? getDemoModules() : modules;
  const props: ScreenProps = { modules: active, navigate, settings, updateSettings };

  if (DEV_ROUTES.includes(route.name)) {
    return (
      <ScrollView style={styles.dev} contentContainerStyle={{ paddingTop: SAFE_TOP }}>
        <View>
          <Button title="Back to developer tools" onPress={() => navigate({ name: 'dev' })} />
        </View>
        {renderRoute(route, props)}
      </ScrollView>
    );
  }

  return <View style={styles.root}>{renderRoute(route, props)}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  dev: { flex: 1, backgroundColor: colors.surface },
});
