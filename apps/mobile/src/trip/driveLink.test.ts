import { describe, expect, it } from 'vitest';

import { DRIVE_LINK_URL, driveLinkAction, isStartDriveUrl } from './driveLink';

describe('isStartDriveUrl', () => {
  it('matches the widget link, with or without extra slashes or a query', () => {
    expect(DRIVE_LINK_URL).toBe('eduway://drive/start');
    expect(isStartDriveUrl('eduway://drive/start')).toBe(true);
    expect(isStartDriveUrl('eduway:///drive/start/')).toBe(true);
    expect(isStartDriveUrl('eduway://drive/start?from=widget')).toBe(true);
  });

  it('matches the Expo Go form so the link can be tried without a build', () => {
    expect(isStartDriveUrl('exp://192.168.1.20:8081/--/drive/start')).toBe(true);
  });

  it('ignores every other launch', () => {
    expect(isStartDriveUrl(null)).toBe(false);
    expect(isStartDriveUrl('')).toBe(false);
    expect(isStartDriveUrl('exp://192.168.1.20:8081')).toBe(false);
    expect(isStartDriveUrl('eduway://')).toBe(false);
    expect(isStartDriveUrl('eduway://drive')).toBe(false);
    expect(isStartDriveUrl('eduway://drive/start/now')).toBe(false);
    expect(isStartDriveUrl('drive/start')).toBe(false);
  });
});

describe('driveLinkAction', () => {
  it('starts a drive unless one is running or the last one is uploading', () => {
    expect(driveLinkAction('idle')).toBe('start');
    expect(driveLinkAction('done')).toBe('start');
    expect(driveLinkAction('queued')).toBe('start');
    expect(driveLinkAction('error')).toBe('start');
    expect(driveLinkAction('starting')).toBe('show');
    expect(driveLinkAction('driving')).toBe('show');
    expect(driveLinkAction('uploading')).toBe('ignore');
  });
});
