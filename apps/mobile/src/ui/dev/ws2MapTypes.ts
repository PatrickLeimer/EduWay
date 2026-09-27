/** Points the WS2 debug map draws with the Google Maps SDK. */
export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface HeatPoint extends MapPoint {
  /** 0–1. Harsh events weigh more than coach events. */
  weight: number;
}

export interface Ws2MapProps {
  latitude: number;
  longitude: number;
  route: MapPoint[];
  heat: HeatPoint[];
}
