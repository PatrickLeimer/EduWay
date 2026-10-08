/**
 * Hands a PNG to the phone's share sheet (Instagram, Messages, Photos...).
 * The file lives in the app cache and is replaced on the next share (§12 "Share card").
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { bytesFromBase64 } from '../lib/shareCard';

export async function sharePng(base64: string, name: string, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available here');
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(bytesFromBase64(base64));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: title,
  });
}
