/**
 * Placeholder app shell: state-based navigation between the placeholder
 * screens. No navigation library until the UI phase.
 */
import { useCallback, useState } from 'react';
import { Button, ScrollView, View } from 'react-native';

import type { AppModules } from '../wiring';

import { DriveRecorderScreen } from './dev/DriveRecorderScreen';
import { Ws1Debug } from './dev/Ws1Debug';
import { Ws2Debug } from './dev/Ws2Debug';
import { Ws3Debug } from './dev/Ws3Debug';
import { Ws4Debug } from './dev/Ws4Debug';
import type { Route, ScreenProps } from './navigation';
import { DevMenuScreen } from './screens/DevMenuScreen';
import { DrivingScreen } from './screens/DrivingScreen';
import { StartDriveScreen } from './screens/StartDriveScreen';
import { TripListScreen } from './screens/TripListScreen';
import { TripResultScreen } from './screens/TripResultScreen';

function renderRoute(route: Route, props: ScreenProps) {
  switch (route.name) {
    case 'start':
      return <StartDriveScreen {...props} />;
    case 'driving':
      return <DrivingScreen {...props} />;
    case 'result':
      return <TripResultScreen {...props} tripId={route.tripId} />;
    case 'list':
      return <TripListScreen {...props} />;
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

/** Screens without a Home button: never leave driving mode by navigation (§4, §16). */
const NO_HOME: Route['name'][] = ['start', 'driving'];

export function Root({ modules }: { modules: AppModules }) {
  const [route, setRoute] = useState<Route>({ name: 'start' });
  const navigate = useCallback((r: Route) => setRoute(r), []);

  return (
    // paddingTop only keeps content below the status bar; real layout comes in the UI phase.
    <ScrollView contentContainerStyle={{ paddingTop: 48 }}>
      {!NO_HOME.includes(route.name) && (
        <View>
          <Button title="Home" onPress={() => navigate({ name: 'start' })} />
        </View>
      )}
      {renderRoute(route, { modules, navigate })}
    </ScrollView>
  );
}
