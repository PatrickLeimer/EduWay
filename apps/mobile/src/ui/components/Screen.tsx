/** Shell for the light screens: back header + scrolling content. */
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, font, SAFE_BOTTOM, SAFE_TOP, space } from '../theme';

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

export function Screen({ title, onBack, backLabel = 'Back', hero, footer, children }: ScreenProps) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
            <Text style={styles.back}>‹ {backLabel}</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {hero}
        <View style={styles.content}>{children}</View>
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
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
  back: { fontSize: font.body, color: colors.text, marginBottom: space.sm },
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
