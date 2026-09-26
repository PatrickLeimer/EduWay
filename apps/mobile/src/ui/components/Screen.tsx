/** Shell for the light screens: back button + large title + scrolling content. */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, font, motion, radius, SAFE_BOTTOM, SAFE_TOP, space } from '../theme';
import { FadeIn, PressableScale } from './motion';

interface ScreenProps {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  /** Rendered edge to edge above the padded content (e.g. a route map). */
  hero?: ReactNode;
  /** Pinned to the bottom, outside the scroll (e.g. the main action). */
  footer?: ReactNode;
  children: ReactNode;
}

/** Chevron drawn with two borders (no icon library). */
function Chevron() {
  return <View style={styles.chevron} />;
}

/** Rounded "‹ Label" pill, Uber/iOS style. Big touch target, springs when pressed. */
export function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
      onPress={onPress}
      hitSlop={10}
      pressedScale={0.94}
      style={styles.backWrap}
      contentStyle={styles.back}
    >
      <View style={styles.backIcon}>
        <Chevron />
      </View>
      <Text style={styles.backText}>{label}</Text>
    </PressableScale>
  );
}

export function Screen({ title, onBack, backLabel = 'Back', hero, footer, children }: ScreenProps) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {onBack ? <BackButton label={backLabel} onPress={onBack} /> : null}
        <FadeIn delay={motion.fast / 2} fromY={8}>
          <Text style={styles.title}>{title}</Text>
        </FadeIn>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {hero ? <FadeIn fromY={0}>{hero}</FadeIn> : null}
        <FadeIn delay={motion.fast} fromY={16} style={styles.content}>
          {children}
        </FadeIn>
      </ScrollView>
      {footer ? (
        <FadeIn delay={motion.normal} fromY={24} style={styles.footer}>
          {footer}
        </FadeIn>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingTop: SAFE_TOP,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: colors.surface,
  },
  backWrap: { alignSelf: 'flex-start', marginBottom: space.md },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingLeft: 4,
    paddingRight: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  backIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm,
  },
  chevron: {
    width: 9,
    height: 9,
    marginLeft: 3,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.text,
    transform: [{ rotate: '45deg' }],
  },
  backText: { fontSize: font.body, fontWeight: '600', color: colors.text },
  title: { fontSize: font.display, fontWeight: '800', color: colors.text },
  scroll: { paddingBottom: space.xxl },
  content: { paddingHorizontal: space.lg },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: SAFE_BOTTOM + space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
