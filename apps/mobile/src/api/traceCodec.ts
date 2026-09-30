/**
 * Encodes the route trace for POST /trips (`traceGzipB64`, see
 * packages/shared/src/api.ts): JSON → gzip (pako) → base64. Pure JS so it
 * behaves the same in Hermes and in Vitest/Node. The server decodes with zlib.
 */
import type { TraceUpload } from '@eduway/shared';
import { gzip, ungzip } from 'pako';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    out += b === undefined ? '=' : B64[(n >> 6) & 63]!;
    out += c === undefined ? '=' : B64[n & 63]!;
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buf = 0;
  let bits = 0;
  let o = 0;
  for (const ch of clean) {
    buf = (buf << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buf >> bits) & 0xff;
    }
  }
  return out;
}

export function encodeTrace(trace: TraceUpload): string {
  return bytesToBase64(gzip(JSON.stringify(trace)));
}

/** Inverse of encodeTrace. Used in tests and debug screens; the server uses zlib. */
export function decodeTrace(b64: string): unknown {
  return JSON.parse(new TextDecoder().decode(ungzip(base64ToBytes(b64))));
}
