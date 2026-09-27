/** Renders any value as pretty-printed JSON text. Placeholder UI helper. */
import { Text } from 'react-native';

export function Json({ value }: { value: unknown }) {
  return <Text selectable>{JSON.stringify(value, null, 2)}</Text>;
}
