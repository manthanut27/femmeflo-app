export const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
};

export const PermissionStatus = {
  UNDETERMINED: 'undetermined',
  GRANTED: 'granted',
  DENIED: 'denied',
};

export let requestForegroundPermissionsAsync = async () => ({
  status: PermissionStatus.GRANTED,
  granted: true,
  canAskAgain: true,
  expires: 'never',
});

export let getCurrentPositionAsync = async (_opts) => ({
  coords: {
    latitude: 19.2183,
    longitude: 72.9781,
    accuracy: 10,
    altitude: 15,
    altitudeAccuracy: 5,
    heading: 0,
    speed: 0,
  },
  timestamp: Date.now(),
});

export let getLastKnownPositionAsync = async (_opts) => null;

export let reverseGeocodeAsync = async (_coords) => [];

export function __setMockImplementation(key, fn) {
  if (key === 'requestForegroundPermissionsAsync') requestForegroundPermissionsAsync = fn;
  if (key === 'getCurrentPositionAsync') getCurrentPositionAsync = fn;
  if (key === 'getLastKnownPositionAsync') getLastKnownPositionAsync = fn;
  if (key === 'reverseGeocodeAsync') reverseGeocodeAsync = fn;
}

export default {
  Accuracy,
  PermissionStatus,
  requestForegroundPermissionsAsync,
  getCurrentPositionAsync,
  getLastKnownPositionAsync,
  reverseGeocodeAsync,
  __setMockImplementation,
};
