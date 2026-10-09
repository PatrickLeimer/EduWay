/** Shell for the light screens: back button + large title + scrolling content. */
import { useEffect, useRef, type ReactNode } from 'react';
import { BackHandler, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, font, fonts, motion, radius, SAFE_BOTTOM, SAFE_TOP, space } from '../theme';
import { FadeIn, PressableScale } from './motion';

interface ScreenProps {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  /** Rendered edge to edge above the padded content (e.g. a route map). */
  hero?: ReactNode;
  /** Pinned to the bottom, outside the scroll (e.g. the main action). */
  footer?: ReactNode;
  /** Pull to refresh (lists that change on the server). */
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
}

/** Chevron drawn with two borders (no icon library). */
function Chevron() {
  return <View style={styles.chevron} />;
}

/**
 * Rounded "‹ Label" pill, Uber/iOS style. Big touch target, springs when pressed.
 * Android's back button/gesture does the same thing while it is on screen.
 */
export function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  const latest = useRef(onPress);
  useEffect(() => {
    latest.current = onPress;
  });
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      latest.current();
      return true;
    });
    return () => sub.remove();
  }, []);
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

export function Screen({
  title,
  onBack,
  backLabel = 'Back',
  hero,
  footer,
  onRefresh,
  refreshing = false,
  children,
}: ScreenProps) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {onBack ? <BackButton label={backLabel} onPress={onBack} /> : null}
        <FadeIn delay={motion.fast / 2} fromY={8}>
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            {title}
          </Text>
        </FadeIn>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        // Taps on buttons work on the first try even with the keyboard open.
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
      >
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
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: SAFE_TOP,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: colors.bg,
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
  backText: { fontSize: font.body, fontFamily: fonts.semiBold, color: colors.text },
  title: { fontSize: font.display, fontFamily: fonts.semiBold, color: colors.text },
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
