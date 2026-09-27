import { describe, expect, it } from 'vitest';

import { directionsUrl, emergencyUrl } from './links';

describe('directionsUrl', () => {
  it('opens Google Maps driving directions to the destination', () => {
    expect(directionsUrl('  Miami Dade College ')).toBe(
      'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=Miami%20Dade%20College',
    );
  });
  it('just opens Maps when there is no destination', () => {
    expect(directionsUrl()).toBe('https://www.google.com/maps/dir/?api=1&travelmode=driving');
    expect(directionsUrl('   ')).toBe('https://www.google.com/maps/dir/?api=1&travelmode=driving');
  });
});

describe('emergencyUrl', () => {
  it('dials the emergency number', () => {
    expect(emergencyUrl()).toBe('tel:911');
  });
});
