/** Trip list (feeds §12 screens 3-5 later). Placeholder. */
import { DEMO_USER_ID } from '@edudriver/shared';
import { Button, Text, View } from 'react-native';

import { useApiQuery } from '../../api';
import type { ScreenProps } from '../navigation';

export function TripListScreen({ modules, navigate }: ScreenProps) {
  const { data, error, loading, reload } = useApiQuery('trips', () =>
    modules.api.listTrips(DEMO_USER_ID),
  );

  return (
    <View>
      <Text>Past trips</Text>
      {loading && <Text>Loading…</Text>}
      {error && <Text>Error: {error}</Text>}
      {data?.trips.map((t) => (
        <Button
          key={t._id}
          title={`${new Date(t.startedAt).toLocaleString()} · ${t.distanceMi} mi · score ${t.score ?? '-'}`}
          onPress={() => navigate({ name: 'result', tripId: t._id })}
        />
      ))}
      {data?.trips.length === 0 && <Text>No trips yet.</Text>}
      <Button title="Reload" onPress={reload} />
    </View>
  );
}
