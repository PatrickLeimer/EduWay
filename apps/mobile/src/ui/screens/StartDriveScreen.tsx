/** Screen 1 (§12): Start drive, with lock and passenger options. Placeholder. */
import { useState } from 'react';
import { Button, Text, View } from 'react-native';

import type { ScreenProps } from '../navigation';

export function StartDriveScreen({ modules, navigate }: ScreenProps) {
  // Lock is on by default (§4 [Proposed]); passenger off.
  const [lockEnabled, setLockEnabled] = useState(true);
  const [passenger, setPassenger] = useState(false);

  const start = () => {
    void modules.trip.start({ lockEnabled, passenger });
    navigate({ name: 'driving' });
  };

  return (
    <View>
      <Text>Start drive</Text>
      <Button
        title={`Driving lock: ${lockEnabled ? 'ON' : 'OFF'}`}
        onPress={() => setLockEnabled((v) => !v)}
      />
      <Button
        title={`I'm a passenger: ${passenger ? 'YES' : 'NO'}`}
        onPress={() => setPassenger((v) => !v)}
      />
      <Button title="Start drive" onPress={start} />
      <Button title="Past trips" onPress={() => navigate({ name: 'list' })} />
      <Button title="Dev menu" onPress={() => navigate({ name: 'dev' })} />
    </View>
  );
}
