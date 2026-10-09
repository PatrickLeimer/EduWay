import type { RefObject } from 'react';
import type { ViewStyle } from 'react-native';

import type { MapPoint } from '../lib/geo';

export interface MapPin extends MapPoint {
  id: string;
  color: string;
  title?: string;
  description?: string;
}

export interface MapCanvasProps {
  style?: ViewStyle;
  /** One route polyline. */
  route?: MapPoint[];
  /** Separate polylines, one per drive, so trips are not joined end to end. */
  routes?: MapPoint[][];
  pins?: MapPin[];
  /** "You are here" / replay car dot. */
  car?: MapPoint | null;
  /** Camera follows this point (driving, home). */
  follow?: MapPoint | null;
  /** Initial camera fits these points (route previews, debrief, replay). */
  fitTo?: MapPoint[];
  /** False = no pan/zoom/tap (driving mode, list thumbnails). */
  interactive?: boolean;
  /** Dark basemap (driving mode). */
  dark?: boolean;
  /** Static bitmap on Android for long lists (react-native-maps liteMode). */
  lite?: boolean;
  /** Satellite imagery instead of the street map (share card background). */
  satellite?: boolean;
  /** Thicker route with a white edge so it reads on satellite (share card). */
  boldRoute?: boolean;
  /** Called once the map and its tiles are drawn, so a snapshot shows them. */
  onLoaded?: () => void;
  /** Filled with a snapshot function (phones only; stays null in the browser). */
  snapshotRef?: RefObject<MapSnapshot | null>;
}

export interface MapSnapshot {
  /** The map as a base64 JPEG, `width` x `height` in layout units. */
  take(width: number, height: number): Promise<string>;
}
