/** Dev menu: one debug screen per workstream. */
import { Button, Text, View } from 'react-native';

import type { ScreenProps } from '../navigation';

export function DevMenuScreen({ navigate }: ScreenProps) {
  return (
    <View>
      <Text>Dev menu</Text>
      <Button title="WS1 Motion detection" onPress={() => navigate({ name: 'ws1' })} />
      <Button title="WS2 Road + trip" onPress={() => navigate({ name: 'ws2' })} />
      <Button title="WS3 Backend + API" onPress={() => navigate({ name: 'ws3' })} />
      <Button title="WS4 Coaching + voice" onPress={() => navigate({ name: 'ws4' })} />
      <Button title="Drive recorder (test drives)" onPress={() => navigate({ name: 'recorder' })} />
    </View>
  );
}
