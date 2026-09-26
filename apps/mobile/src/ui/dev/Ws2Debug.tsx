/**
 * WS2 debug screen (owned by WS2). Road cache status and the current way match
 * for the trip's latest GPS fix. Start a drive first to see live values.
 */
import { Text, View } from 'react-native';

import { useTripState } from '../../trip';
import { Json } from '../Json';
import type { ScreenProps } from '../navigation';

export function Ws2Debug({ modules }: ScreenProps) {
  const state = useTripState(modules.trip);
  const fix = state.latestFix;

  return (
    <View>
      <Text>WS2 Road + trip</Text>
      <Text>
        Trip status: {state.status} · fixes: {state.traceLength}
      </Text>
      <Text>Latest fix:</Text>
      <Json value={fix} />
      <Text>Road match (latest fix):</Text>
      <Json value={fix ? modules.roadCache.match(fix) : null} />
      <Text>Road cache status:</Text>
      <Json value={modules.roadCache.getStatus()} />
      <Text>© OpenStreetMap contributors</Text>
    </View>
  );
}
