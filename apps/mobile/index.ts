import { registerRootComponent } from 'expo';

import App from './App';
import { registerDriveWidget } from './src/ui/widget/syncDriveWidget';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Home-screen "Drive" widget (ui/widget/). No-op in Expo Go, which has no widgets.
registerDriveWidget();
