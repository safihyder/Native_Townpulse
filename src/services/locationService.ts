import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export type LocationCoords = {
  latitude: number;
  longitude: number;
};

export type LocationResult = {
  coords: LocationCoords;
  address: string;
};

/**
 * Request location permission on Android.
 * Returns true if granted.
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);

      const fineLocationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
      const coarseLocationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;

      return fineLocationGranted || coarseLocationGranted;
    } catch {
      return false;
    }
  }
  // iOS handles this via Info.plist
  return true;
}

/**
 * Get the user's current position.
 * 
 * Strategy (same as Zomato / Google Maps):
 *   1. Try network/WiFi first (enableHighAccuracy: false) — fast, works indoors
 *   2. If that fails, try GPS satellite (enableHighAccuracy: true) — precise, needs sky
 *   3. Accept cached positions up to 60 seconds old to avoid unnecessary waits
 */
export function getCurrentPosition(): Promise<LocationCoords> {
  return new Promise((resolve, reject) => {
    // ATTEMPT 1: Network/WiFi location (fast, works indoors)
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        // Network provider failed — try GPS hardware as fallback
        Geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err2) => reject(err2),
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
        );
      },
      {
        enableHighAccuracy: false,  // Network/WiFi first — fast
        timeout: 10000,
        maximumAge: 60000,          // Accept 60s-old cached position
      },
    );
  });
}

/**
 * Reverse geocode coordinates to a human-readable address using the
 * free Nominatim (OpenStreetMap) API. No API key needed.
 */
export async function reverseGeocode(coords: LocationCoords): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TownPulseApp/1.0' },
    });
    const data = await response.json();

    if (data?.address) {
      const a = data.address;
      // Build a short address label
      const parts: string[] = [];
      if (a.road) parts.push(a.road);
      if (a.suburb) parts.push(a.suburb);
      if (a.city || a.town || a.village) parts.push(a.city || a.town || a.village);
      return parts.slice(0, 2).join(', ') || data.display_name?.split(',').slice(0, 2).join(',') || 'Current Location';
    }
    return 'Current Location';
  } catch {
    return 'Current Location';
  }
}

/**
 * High-level helper: request permission → get coords → reverse geocode.
 */
export async function fetchLiveLocation(): Promise<LocationResult> {
  const granted = await requestLocationPermission();
  if (!granted) {
    throw new Error('Location permission denied');
  }

  const coords = await getCurrentPosition();
  const address = await reverseGeocode(coords);

  return { coords, address };
}

/**
 * Check if device GPS / Location Services are actually enabled.
 * 
 * Uses a two-step check:
 *   1. Try network provider (enableHighAccuracy: false) — if this works, location is on
 *   2. If it fails with code 2, try GPS provider — if that also fails with code 2,
 *      then location services are truly disabled
 */
export async function checkLocationServicesEnabled(): Promise<boolean> {
  return new Promise((resolve) => {
    // Step 1: Try network/WiFi (fast check)
    Geolocation.getCurrentPosition(
      () => resolve(true),
      (error) => {
        if (error.code === 2) {
          // Step 2: Network failed — try GPS hardware
          Geolocation.getCurrentPosition(
            () => resolve(true),
            (err2) => {
              // Only code 2 on BOTH attempts means location is truly disabled
              resolve(err2.code !== 2);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
          );
        } else {
          // Error code 1 (permission) or 3 (timeout) — doesn't mean GPS is off
          resolve(true);
        }
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    );
  });
}

/**
 * Extended coords type for watch callbacks (includes heading/speed/accuracy).
 */
export type WatchLocationCoords = LocationCoords & {
  heading?: number;
  speed?: number;
  accuracy?: number;
};

/**
 * Start continuous GPS watch for delivery partner tracking.
 * 
 * Uses enableHighAccuracy: false initially so it starts fast with network location,
 * then Android's LocationManager will automatically switch to GPS when available.
 * The distanceFilter ensures we only get updates on meaningful movement.
 * 
 * Returns watchId — call Geolocation.clearWatch(watchId) to stop.
 */
export function watchCurrentPosition(
  onPosition: (coords: WatchLocationCoords) => void,
  onError: (error: { code: number; message: string }) => void,
): number {
  return Geolocation.watchPosition(
    (position) => {
      onPosition({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        heading: position.coords.heading ?? undefined,
        speed: position.coords.speed ?? undefined,
        accuracy: position.coords.accuracy ?? undefined,
      });
    },
    (error) => onError({ code: error.code, message: error.message }),
    {
      enableHighAccuracy: false,  // Start with network (fast), Android auto-upgrades to GPS
      distanceFilter: 5,          // Update every 5 meters for smooth tracking
      interval: 3000,             // Android: poll every 3 seconds
      fastestInterval: 1000,      // Android: accept updates as fast as 1s
    },
  );
}
