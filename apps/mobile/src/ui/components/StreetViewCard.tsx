/**
 * Street View callout in the coach chat (master doc §12 "Street View callout").
 * A thumbnail of where the infraction happened, facing the way the student was
 * driving, with Gemini's caption. Tap to open the interactive panorama
 * full screen. Both URLs point to our backend; no Google keys in the app.
 *
 * States: a placeholder while the thumbnail loads; if the thumbnail or the
 * panorama fails, the caption stays with a short "not available" note.
 */
import type { StreetViewCallout } from '@eduway/shared';
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { API_BASE_URL } from '../../api';
import { absoluteUrl } from '../lib/url';
import { colors, edge, font, fonts, lip, radius, SAFE_BOTTOM, SAFE_TOP, space } from '../theme';

const UNAVAILABLE = 'Street View isn’t available right now.';

export function StreetViewCard({ callout }: { callout: StreetViewCallout }) {
  const [image, setImage] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [open, setOpen] = useState(false);
  const [panoFailed, setPanoFailed] = useState(false);
  const thumbnail = absoluteUrl(callout.thumbnailUrl, API_BASE_URL);
  const panorama = absoluteUrl(callout.panoramaUrl, API_BASE_URL);
  const place = callout.street ?? 'Where it happened';

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>STREET VIEW</Text>
      <Text style={styles.street}>{place}</Text>

      {image === 'failed' ? (
        <Text style={styles.unavailable}>{UNAVAILABLE}</Text>
      ) : (
        <Pressable
          onPress={() => {
            setPanoFailed(false);
            setOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Open Street View of ${place}`}
          style={({ pressed }) => [styles.photoWrap, pressed && styles.pressed]}
        >
          <Image
            source={{ uri: thumbnail }}
            style={styles.photo}
            resizeMode="cover"
            onLoad={() => setImage('ok')}
            onError={() => setImage('failed')}
          />
          {image === 'loading' ? (
            <View style={styles.placeholder}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.hint}>
              <Text style={styles.hintText}>Tap to look around</Text>
            </View>
          )}
        </Pressable>
      )}

      {callout.caption ? <Text style={styles.caption}>{callout.caption}</Text> : null}

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modal}>
          {panoFailed ? (
            <View style={styles.modalMessage}>
              <Text style={styles.modalMessageText}>{UNAVAILABLE}</Text>
            </View>
          ) : (
            <WebView
              source={{ uri: panorama }}
              style={styles.webview}
              originWhitelist={['*']}
              javaScriptEnabled
              startInLoadingState
              renderLoading={() => (
                <View style={styles.modalMessage}>
                  <ActivityIndicator color={colors.textOnDark} />
                </View>
              )}
              onError={() => setPanoFailed(true)}
              onHttpError={() => setPanoFailed(true)}
            />
          )}
          <View style={styles.topBar}>
            <Pressable
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close Street View"
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
          {callout.caption ? (
            <View style={styles.bottomBar}>
              <Text style={styles.modalStreet}>{place}</Text>
              <Text style={styles.modalCaption}>{callout.caption}</Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.sm,
    marginTop: space.md,
    ...edge,
  },
  kicker: {
    fontSize: font.tiny,
    fontFamily: fonts.semiBold,
    letterSpacing: 1.5,
    color: colors.good,
  },
  street: { fontSize: font.title, fontFamily: fonts.semiBold, color: colors.text },
  photoWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    aspectRatio: 640 / 400,
    backgroundColor: colors.surfaceAlt,
  },
  photo: { width: '100%', height: '100%' },
  placeholder: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    position: 'absolute',
    right: space.sm,
    bottom: space.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    borderBottomWidth: lip.pressed,
    borderBottomColor: colors.primaryLip,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  hintText: { color: colors.onColor, fontSize: font.small, fontFamily: fonts.semiBold },
  pressed: { opacity: 0.8 },
  caption: { fontSize: font.body, lineHeight: 22, color: colors.text, fontFamily: fonts.regular },
  unavailable: { fontSize: font.body, color: colors.textMuted, fontFamily: fonts.regular },
  modal: { flex: 1, backgroundColor: colors.driveBg },
  webview: { flex: 1, backgroundColor: colors.driveBg },
  modalMessage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: colors.driveBg,
  },
  modalMessageText: {
    color: colors.textOnDark,
    fontSize: font.body,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  topBar: { position: 'absolute', top: SAFE_TOP, left: space.lg },
  close: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    ...edge,
  },
  closeText: { fontSize: font.body, fontFamily: fonts.semiBold, color: colors.text },
  bottomBar: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: SAFE_BOTTOM + space.lg,
    backgroundColor: colors.drivePanel,
    borderRadius: radius.lg,
    borderBottomWidth: lip.rest,
    borderBottomColor: colors.driveBorder,
    padding: space.md,
    gap: 2,
  },
  modalStreet: { color: colors.textOnDark, fontSize: font.body, fontFamily: fonts.semiBold },
  modalCaption: {
    color: colors.textOnDark,
    fontSize: font.body,
    lineHeight: 22,
    fontFamily: fonts.regular,
  },
});
