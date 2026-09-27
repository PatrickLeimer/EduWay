// Placeholder test: proves Vitest runs pure trip logic, and that the recorder's
// output matches the shared upload contract.
import { TraceUploadSchema } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import { createTraceBuffer } from './traceBuffer';

describe('traceBuffer', () => {
  it('records fixes as columnar arrays in seconds since start', () => {
    const start = Date.parse('2026-09-26T15:00:00Z');
    const buf = createTraceBuffer(start);
    buf.append({ t: start, lat: 25.76, lon: -80.37, speedMps: 0, heading: null, accuracyM: 5 });
    buf.append({
      t: start + 1000,
      lat: 25.7601,
      lon: -80.37,
      speedMps: 1.2,
      heading: 0,
      accuracyM: 5,
    });

    const upload = TraceUploadSchema.parse(buf.toUpload());
    expect(buf.length).toBe(2);
    expect(upload.t).toEqual([0, 1]);
    expect(upload.speedMps).toEqual([0, 1.2]);
  });
});
