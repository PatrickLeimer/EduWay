/**
 * Google Maps night style for driving mode. Shared by the native Android map
 * (customMapStyle) and the iPhone WebView map (Maps JavaScript API `styles`).
 */
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d2126' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a9099' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d2126' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2e343c' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c434d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1318' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
