/**
 * App entry. Renders ui/ only; module selection (real vs mock) lives in
 * src/wiring.ts.
 */
import { StatusBar } from 'expo-status-bar';

import { Root } from './src/ui/Root';
import { modules } from './src/wiring';

export default function App() {
  return (
    <>
      <Root modules={modules} />
      <StatusBar style="auto" />
    </>
  );
}
