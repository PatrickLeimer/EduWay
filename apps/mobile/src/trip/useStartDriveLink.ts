/**
 * Listens for the "Start drive" link (driveLink.ts): the URL the app was opened
 * with, and links that arrive while it is already open. Starts the drive with
 * the saved driving-lock default (never as a passenger) and calls onDriving so
 * the screen can switch to Driving.
 */
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';

import type { TripSession } from '../contracts';
import { driveLinkAction, isStartDriveUrl } from './driveLink';

export interface StartDriveLinkOptions {
  session: TripSession;
  lockEnabled: boolean;
  onDriving: () => void;
}

export function useStartDriveLink(options: StartDriveLinkOptions): void {
  // The listener is added once; it reads the latest session and settings from here.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    const handle = (url: string | null) => {
      if (!isStartDriveUrl(url)) return;
      const { session, lockEnabled, onDriving } = latest.current;
      const action = driveLinkAction(session.getState().status);
      if (action === 'ignore') return;
      if (action === 'start') void session.start({ lockEnabled, passenger: false });
      onDriving();
    };
    let alive = true;
    void Linking.getInitialURL()
      .then((url) => {
        if (alive) handle(url);
      })
      .catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
}
