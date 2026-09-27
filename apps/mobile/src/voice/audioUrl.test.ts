import { describe, expect, it } from 'vitest';

import { resolveAudioUrl } from './audioUrl';

describe('resolveAudioUrl', () => {
  it('prefixes a relative server path with the API base URL', () => {
    expect(resolveAudioUrl('/audio/t1.mp3', 'http://10.0.0.5:4000')).toBe(
      'http://10.0.0.5:4000/audio/t1.mp3',
    );
    expect(resolveAudioUrl('audio/t1.mp3', 'https://api.example.com/')).toBe(
      'https://api.example.com/audio/t1.mp3',
    );
  });

  it('leaves absolute URLs alone', () => {
    expect(resolveAudioUrl('https://cdn.example.com/a.mp3', 'http://x')).toBe(
      'https://cdn.example.com/a.mp3',
    );
  });
});
