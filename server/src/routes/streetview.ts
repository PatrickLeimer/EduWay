/**
 * /streetview endpoints (WS3). Master doc §12 "Street View callout", §13.
 * The app only ever calls these; Google keys and URLs stay on the server.
 * - GET /streetview/:tripId/thumbnail: the Static API image, streamed through
 *   and never stored (short cache header only).
 * - GET /streetview/:tripId/panorama: a small page with the Maps JavaScript
 *   Street View panorama, for the app's WebView.
 */
import { STREET_VIEW, type StreetViewCallout } from '@eduway/shared';
import { Router } from 'express';

import { toCallout, type StreetViewService } from '../streetview';

import type { RouteDeps } from './deps';
import { HttpError } from './http';

export function streetViewRouter({ repo, streetView: google }: RouteDeps): Router {
  const r = Router();

  /** The trip's saved callout, or 404: no callout means no Street View, never an error for the student. */
  async function locate(
    tripId: string,
  ): Promise<{ google: StreetViewService; callout: StreetViewCallout }> {
    if (!google) throw new HttpError(404, 'Street View is not enabled');
    const stored = await repo.getStreetView(tripId);
    const found = stored ? await repo.getTrip(tripId) : null;
    const callout = stored && found ? toCallout(tripId, stored, found.events) : null;
    if (!callout) throw new HttpError(404, 'No Street View for this trip');
    return { google, callout };
  }

  r.get('/:tripId/thumbnail', async (req, res) => {
    const { google, callout } = await locate(req.params.tripId);
    const image = await google.fetchThumbnail(callout.lat, callout.lng, callout.heading);
    if (!image) throw new HttpError(404, 'No Street View imagery');
    res
      .set('Cache-Control', `private, max-age=${STREET_VIEW.thumbnailCacheS}`)
      .type(image.contentType)
      .send(image.bytes);
  });

  r.get('/:tripId/panorama', async (req, res) => {
    const { google, callout } = await locate(req.params.tripId);
    const html = google.panoramaHtml(callout.lat, callout.lng, callout.heading);
    if (!html) throw new HttpError(404, 'Street View panorama is not enabled');
    res.set('Cache-Control', 'no-store').type('html').send(html);
  });

  return r;
}
