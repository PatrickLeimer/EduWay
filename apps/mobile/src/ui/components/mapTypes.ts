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
}
