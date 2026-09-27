/**
 * WS3 debug screen (owned by WS3). Calls API endpoints and dumps the JSON.
 * Uses whichever ApiClient wiring selected (mock by default).
 */
import { DEMO_USER_ID } from '@edudriver/shared';
import { useState } from 'react';
import { Button, Text, View } from 'react-native';

import { API_BASE_URL } from '../../api';
import { Json } from '../Json';
import type { ScreenProps } from '../navigation';

export function Ws3Debug({ modules }: ScreenProps) {
  const [output, setOutput] = useState<unknown>(null);

  const call = (fn: () => Promise<unknown>) => {
    setOutput('…');
    fn().then(setOutput, (e: unknown) => setOutput(String(e)));
  };

  const firstTripId = async () => {
    const { trips } = await modules.api.listTrips(DEMO_USER_ID);
    if (!trips[0]) throw new Error('No trips');
    return trips[0]._id;
  };

  return (
    <View>
      <Text>WS3 Backend + API (base URL if real: {API_BASE_URL})</Text>
      <Button title="GET /trips" onPress={() => call(() => modules.api.listTrips(DEMO_USER_ID))} />
      <Button
        title="GET /trips/:id (first)"
        onPress={() => call(async () => modules.api.getTrip(await firstTripId()))}
      />
      <Button
        title="GET /trips/:id/trace (length only)"
        onPress={() =>
          call(async () => ({ fixes: (await modules.api.getTrace(await firstTripId())).t.length }))
        }
      />
      <Button
        title="GET /progress"
        onPress={() => call(() => modules.api.getProgress(DEMO_USER_ID))}
      />
      <Button
        title="POST /ask"
        onPress={() => call(() => modules.api.ask(DEMO_USER_ID, 'Am I getting better at stops?'))}
      />
      <Json value={output} />
    </View>
  );
}
