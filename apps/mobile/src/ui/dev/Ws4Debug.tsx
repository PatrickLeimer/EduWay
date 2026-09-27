/**
 * WS4 debug screen (owned by WS4). Fire each live alert to check clips and
 * cooldown, and play the fixture debrief.
 */
import { LiveAlertTypeSchema, type LiveAlertType } from '@edudriver/shared';
import { useState } from 'react';
import { Button, Text, View } from 'react-native';

import type { ScreenProps } from '../navigation';

export function Ws4Debug({ modules }: ScreenProps) {
  const [log, setLog] = useState<string[]>([]);

  const fire = (type: LiveAlertType) => {
    const played = modules.alerts.play(type, { limitMph: type === 'speeding' ? 30 : null });
    setLog((l) => [`${type}: ${played ? 'played' : 'suppressed (cooldown)'}`, ...l].slice(0, 20));
  };

  return (
    <View>
      <Text>WS4 Coaching + voice</Text>
      {LiveAlertTypeSchema.options.map((t) => (
        <Button key={t} title={`Alert: ${t}`} onPress={() => fire(t)} />
      ))}
      <Button title="Reset cooldowns" onPress={() => modules.alerts.reset()} />
      <Button
        title="Play fixture debrief"
        onPress={() =>
          void modules.debrief.play('https://example.invalid/audio/trip-fixture-001.mp3')
        }
      />
      {log.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </View>
  );
}
