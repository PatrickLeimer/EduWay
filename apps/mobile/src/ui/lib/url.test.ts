import { describe, expect, it } from 'vitest';

import { absoluteUrl } from './url';

describe('absoluteUrl', () => {
  it('prefixes a server path with the API base URL', () => {
    expect(absoluteUrl('/streetview/t1/thumbnail', 'http://10.0.0.5:4000')).toBe(
      'http://10.0.0.5:4000/streetview/t1/thumbnail',
    );
    expect(absoluteUrl('streetview/t1/panorama', 'https://api.example.com/')).toBe(
      'https://api.example.com/streetview/t1/panorama',
    );
  });

  it('leaves absolute URLs alone', () => {
    expect(absoluteUrl('https://x.example.com/a.jpg', 'http://y')).toBe(
      'https://x.example.com/a.jpg',
    );
  });
});
