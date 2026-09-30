import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import App from './App';
import { driveWidgetTaskHandler } from './src/ui/widget/AndroidDriveWidget';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Android home-screen "Drive" widget (ui/widget/). Only registers a headless
// task, so it is harmless in Expo Go, where the widget itself doesn't exist.
if (Platform.OS === 'android') registerWidgetTaskHandler(driveWidgetTaskHandler);
