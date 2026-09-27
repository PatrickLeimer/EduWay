/**
 * Shown when a screen can't load from the server. Says which address the app
 * tried and points to Developer tools, instead of a bare "Network error".
 */
import { StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL } from '../../api';
import { colors, font, fonts, radius, space } from '../theme';
import { Button } from './Button';
import { FadeIn } from './motion';

export function ConnectionError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const network = /network|fetch|timed? ?out|connect/i.test(error);
  return (
    <FadeIn style={styles.box}>
      <Text style={styles.title}>
        {network ? "Can't reach the EduDriver server" : 'Something went wrong'}
      </Text>
      <Text style={styles.body}>
        {network
          ? `Tried ${API_BASE_URL}. Make sure the server is running and this phone can reach it (Settings → Developer tools → Test connection).`
          : error}
      </Text>
      {onRetry ? (
        <View style={styles.action}>
          <Button title="Try again" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: space.lg,
    marginTop: space.lg,
  },
  title: { fontSize: font.body, fontFamily: fonts.semiBold, color: colors.text },
  body: {
    fontFamily: fonts.regular,
    fontSize: font.small,
    color: colors.textMuted,
    marginTop: space.xs,
    lineHeight: 18,
  },
  action: { marginTop: space.md },
});
