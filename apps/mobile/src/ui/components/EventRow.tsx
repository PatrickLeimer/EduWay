/** One recorded event in a list (debrief, replay). Never shown while driving. */
import type { RecordedEvent } from '@edudriver/shared';
import { StyleSheet, Text, View } from 'react-native';

import { EVENT_LABEL } from '../lib/format';
import { colors, font, fonts, space } from '../theme';
import { TierDot } from './primitives';

export function EventRow({ event, time }: { event: RecordedEvent; time?: string }) {
  const details = [
    event.street,
    `${Math.round(event.speedMph)} mph`,
    event.limitMph != null ? `limit ${event.limitMph}` : null,
    event.alerted ? 'voice alert played' : null,
  ].filter(Boolean);
  return (
    <View style={styles.row}>
      <TierDot tier={event.tier} />
      <View style={styles.text}>
        <Text style={styles.title}>
          {EVENT_LABEL[event.type]}
          {event.tier === 'harsh' ? ' · harsh' : ''}
        </Text>
        <Text style={styles.details}>{details.join(' · ')}</Text>
      </View>
      {time ? <Text style={styles.time}>{time}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  text: { flex: 1 },
  title: { fontSize: font.body, fontFamily: fonts.semiBold, color: colors.text },
  details: {
    fontFamily: fonts.regular,
    fontSize: font.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  time: { fontFamily: fonts.regular, fontSize: font.small, color: colors.textMuted },
});
