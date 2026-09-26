/**
 * Screen 3 (§12): Trip debrief. Placeholder: score and coaching as plain text/JSON.
 * tripId null → the trip that just ended (TripSession state); otherwise loads
 * the trip from the API.
 */
import { Button, Text, View } from 'react-native';

import { useApiQuery } from '../../api';
import { useTripState } from '../../trip';
import { Json } from '../Json';
import type { ScreenProps } from '../navigation';

export function TripResultScreen({
  modules,
  navigate,
  tripId,
}: ScreenProps & { tripId: string | null }) {
  const state = useTripState(modules.trip);
  const loaded = useApiQuery(`trip:${tripId ?? 'current'}`, () =>
    tripId ? modules.api.getTrip(tripId) : Promise.resolve(null),
  );

  const trip = tripId ? loaded.data?.trip : state.result?.trip;

  const done = () => {
    if (!tripId) modules.trip.reset();
    navigate({ name: tripId ? 'list' : 'start' });
  };

  return (
    <View>
      <Text>Trip result</Text>
      {!tripId && state.status !== 'done' && (
        <Text>
          Upload: {state.status} {state.error ?? ''}
        </Text>
      )}
      {loaded.loading && tripId && <Text>Loading…</Text>}
      {loaded.error && <Text>Error: {loaded.error}</Text>}
      {trip && (
        <>
          <Text>Score: {trip.score ?? 'n/a (passenger)'}</Text>
          <Text>Distance: {trip.distanceMi} mi</Text>
          <Text>Debrief audio: {trip.coachAudioUrl ?? 'none'}</Text>
          <Text>Coaching:</Text>
          <Json value={trip.coach} />
          <Text>Counts:</Text>
          <Json value={trip.counts} />
        </>
      )}
      <Button title="Done" onPress={done} />
    </View>
  );
}
