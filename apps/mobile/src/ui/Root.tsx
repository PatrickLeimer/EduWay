/**
 * App shell: state-based navigation between screens (see navigation.ts).
 * Product screens (and the dev menu) draw their own full-screen layout; the
 * WS1–WS4 debug screens keep the plain scrolling wrapper they were built for.
 * Lexend is loaded here before anything renders.
 */
import { Lexend_400Regular, Lexend_600SemiBold, useFonts } from '@expo-google-fonts/lexend';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';

import { useStartDriveLink } from '../trip';
import { getDemoModules, type AppModules } from '../wiring';

import { DriveRecorderScreen } from './dev/DriveRecorderScreen';
import { Ws1Debug } from './dev/Ws1Debug';
import { Ws2Debug } from './dev/Ws2Debug';
import { Ws3Debug } from './dev/Ws3Debug';
import { Ws4Debug } from './dev/Ws4Debug';
import { ScreenTransition } from './components/motion';
import { BackButton } from './components/Screen';
import { routeKey, transitionFor, type TransitionKind } from './lib/transitions';
import { DEFAULT_SETTINGS, type AppSettings, type Route, type ScreenProps } from './navigation';
import { CoachScreen } from './screens/CoachScreen';
import { DevMenuScreen } from './screens/DevMenuScreen';
import { DrivingScreen } from './screens/DrivingScreen';
import { GrowthScreen } from './screens/GrowthScreen';
import { InfractionsScreen } from './screens/InfractionsScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { ReplayScreen } from './screens/ReplayScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StartDriveScreen } from './screens/StartDriveScreen';
import { PastDriveSummaryScreen, TripEndedScreen } from './screens/TripEndedScreen';
import { TripListScreen } from './screens/TripListScreen';
import { colors, SAFE_TOP, space } from './theme';
import { useDriveWidgetSync } from './widget/useDriveWidgetSync';

function renderRoute(route: Route, props: ScreenProps) {
  switch (route.name) {
    case 'start':
      return <StartDriveScreen {...props} />;
    case 'driving':
      return <DrivingScreen {...props} />;
    case 'ended':
      // A tripId means a past drive; without one it's the drive that just ended.
      return route.tripId ? (
        <PastDriveSummaryScreen {...props} tripId={route.tripId} />
      ) : (
        <TripEndedScreen {...props} />
      );
    case 'replay':
      return <ReplayScreen {...props} tripId={route.tripId} origin={route.origin} />;
    case 'infractions':
      return <InfractionsScreen {...props} tripId={route.tripId} origin={route.origin} />;
    case 'growth':
      return <GrowthScreen {...props} tripId={route.tripId} origin={route.origin} />;
    case 'coach':
      return <CoachScreen {...props} tripId={route.tripId} origin={route.origin} />;
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
  const [nav, setNav] = useState<{ route: Route; kind: TransitionKind }>({
    route: { name: 'start' },
    kind: 'fade',
  });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const navigate = useCallback(
    (r: Route) => setNav((prev) => ({ route: r, kind: transitionFor(prev.route.name, r.name) })),
    [],
  );
  const { route, kind } = nav;

  // Android back: screens with a back button handle it themselves (BackButton,
  // registered later, so it runs first). Anywhere else but Home, swallow it so
  // the app never closes mid-flow (e.g. while a drive is uploading).
  const routeName = useRef(route.name);
  useEffect(() => {
    routeName.current = route.name;
  });
  useEffect(() => {
    const sub = BackHandler.addEventListener(
      'hardwareBackPress',
      () => routeName.current !== 'start',
    );
    return () => sub.remove();
  }, []);
  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => setSettings((s) => ({ ...s, ...patch })),
    [],
  );
  // Test drive swaps in the simulated modules; Settings only allows it while no trip is running.
  const active = settings.demoMode ? getDemoModules() : modules;

  // Home-screen "Drive" widget: its link starts a drive and opens Driving.
  useStartDriveLink({
    session: active.trip,
    lockEnabled: settings.lockByDefault,
    onDriving: () => navigate({ name: 'driving' }),
  });
  useDriveWidgetSync(active);

  const [fontsLoaded, fontError] = useFonts({ Lexend_400Regular, Lexend_600SemiBold });
  // A failed font load falls back to the system font rather than a blank app.
  if (!fontsLoaded && !fontError) return <View style={styles.backdrop} />;
  const props: ScreenProps = { modules: active, navigate, settings, updateSettings };

  // A new key remounts the transition, so every screen change animates in.
  // The backdrop matches the incoming screen so the fade never flashes white.
  const dark = route.name === 'driving';
  return (
    <View style={[styles.backdrop, dark && styles.backdropDark]}>
      <ScreenTransition key={routeKey(route)} kind={kind}>
        {DEV_ROUTES.includes(route.name) ? (
          <ScrollView style={styles.dev} contentContainerStyle={styles.devContent}>
            <BackButton label="Developer tools" onPress={() => navigate({ name: 'dev' })} />
            {renderRoute(route, props)}
          </ScrollView>
        ) : (
          renderRoute(route, props)
        )}
      </ScreenTransition>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.surface },
  backdropDark: { backgroundColor: colors.driveBg },
  dev: { flex: 1, backgroundColor: colors.surface },
  devContent: { paddingTop: SAFE_TOP, paddingHorizontal: space.sm },
});
