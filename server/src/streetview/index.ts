/** streetview/ public API (WS3). Master doc §12 "Street View callout". */
export {
  createGoogleStreetView,
  type GoogleStreetViewOptions,
  type StreetViewService,
} from './google';
export { isRecurringSpot } from './pick';
export { pickStreetView, toCallout, type StreetViewChoice } from './select';
