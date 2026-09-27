/**
 * Footer for the post-trip flow (lib/flow.ts): step dots and one big button
 * (Next, or Done on the last step).
 */
import { StyleSheet, View } from 'react-native';

import { FLOW_STEPS, stepNumber, type FlowStep } from '../lib/flow';
import { colors, radius, space } from '../theme';
import { Button } from './Button';

export function FlowFooter({
  step,
  title = 'Next',
  onPress,
}: {
  step: FlowStep;
  title?: string;
  onPress: () => void;
}) {
  const current = stepNumber(step);
  return (
    <View style={styles.wrap}>
      <View
        style={styles.dots}
        accessibilityLabel={`Step ${current} of ${FLOW_STEPS.length}`}
        accessible
      >
        {FLOW_STEPS.map((s, i) => (
          <View key={s} style={[styles.dot, i + 1 === current && styles.dotOn]} />
        ))}
      </View>
      <Button title={title} large onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.border },
  dotOn: { width: 24, backgroundColor: colors.route },
});
