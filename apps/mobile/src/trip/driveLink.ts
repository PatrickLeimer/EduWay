/**
 * "Start drive" link: the home-screen widget (ui/widget/) opens
 * eduway://drive/start and the app starts a drive with the saved settings, as
 * if Drive was tapped on the start screen. Still a manual start (the driver
 * taps it), never automatic (root CLAUDE.md "Out of scope"). Pure, tested in
 * driveLink.test.ts; the React Native side is useStartDriveLink.ts.
 */
import type { TripStatus } from '../contracts';

/** The app's URL scheme (app.json `scheme`). */
export const APP_SCHEME = 'eduway';
export const DRIVE_LINK_PATH = 'drive/start';
export const DRIVE_LINK_URL = `${APP_SCHEME}://${DRIVE_LINK_PATH}`;

/**
 * True for eduway://drive/start, and for the same path behind Expo Go's
 * exp://<host>/--/ prefix so the link can be tried without a build.
 */
export function isStartDriveUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const match = /^[a-z][a-z0-9+.-]*:\/\/(.*)$/i.exec(url.split(/[?#]/)[0]!);
  if (!match) return false;
  let path = match[1]!;
  const expoGo = path.indexOf('/--/');
  if (expoGo >= 0) path = path.slice(expoGo + 4);
  return path.replace(/^\/+|\/+$/g, '') === DRIVE_LINK_PATH;
}

/**
 * What the link does for the current trip: start a new drive, show the one
 * already running, or nothing while the last drive is still uploading (a new
 * start would be refused then).
 */
export function driveLinkAction(status: TripStatus): 'start' | 'show' | 'ignore' {
  if (status === 'starting' || status === 'driving') return 'show';
  if (status === 'uploading') return 'ignore';
  return 'start';
}
