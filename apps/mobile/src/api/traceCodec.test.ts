// Proves the phone's trace encoding is readable by the server's decoder (Node zlib).
import { gunzipSync } from 'node:zlib';

import { traceFixture } from '@eduway/fixtures';
import { TraceUploadSchema } from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import { base64ToBytes, bytesToBase64, decodeTrace, encodeTrace } from './traceCodec';

describe('traceCodec', () => {
  const upload = TraceUploadSchema.parse(traceFixture);

  it('round-trips base64 for every padding length', () => {
    for (const bytes of [[], [1], [1, 2], [1, 2, 3], [255, 0, 128, 7]]) {
      const b = new Uint8Array(bytes);
      expect(bytesToBase64(b)).toBe(Buffer.from(b).toString('base64'));
      expect(Array.from(base64ToBytes(bytesToBase64(b)))).toEqual(bytes);
    }
  });

  it('produces gzip+base64 that Node zlib can read', () => {
    const b64 = encodeTrace(upload);
    const json = gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
    expect(JSON.parse(json)).toEqual(upload);
    expect(decodeTrace(b64)).toEqual(upload);
  });
});
