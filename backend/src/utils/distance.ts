/**
 * Geographic coordinate calculation and corridor route-matching utilities.
 * Uses the Haversine formula, Spherical Cross-Track distance calculation,
 * and built-in geocoding lookup for major Indian transit hubs and cities.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

/**
 * Built-in coordinate lookup table for common Indian universities, corridors, transit hubs, and cities.
 * Enables zero-external-dependency location geocoding.
 */
export const CITY_COORDINATES: Record<string, Coordinates> = {
  // Universities & Campuses
  'rishihood university': { latitude: 28.9863, longitude: 77.0688 },
  'rishihood': { latitude: 28.9863, longitude: 77.0688 },
  'sonipat': { latitude: 28.9931, longitude: 77.0151 },
  'iit delhi': { latitude: 28.545, longitude: 77.1926 },
  'delhi university': { latitude: 28.6894, longitude: 77.2104 },
  'north campus': { latitude: 28.6894, longitude: 77.2104 },

  // Delhi NCR Hubs
  'connaught place': { latitude: 28.6304, longitude: 77.2177 },
  'cp': { latitude: 28.6304, longitude: 77.2177 },
  'delhi': { latitude: 28.6139, longitude: 77.209 },
  'cyber hub': { latitude: 28.4986, longitude: 77.0878 },
  'gurugram': { latitude: 28.4595, longitude: 77.0266 },
  'gurgaon': { latitude: 28.4595, longitude: 77.0266 },
  'noida': { latitude: 28.5355, longitude: 77.391 },
  'noida sector 62': { latitude: 28.628, longitude: 77.3649 },
  'indirapuram': { latitude: 28.6415, longitude: 77.3714 },
  'ghaziabad': { latitude: 28.6692, longitude: 77.4538 },
  'faridabad': { latitude: 28.4089, longitude: 77.3178 },
  'akshardham': { latitude: 28.6127, longitude: 77.2773 },
  'aiims': { latitude: 28.5672, longitude: 77.21 },

  // Major Cities along Highway & Transit Corridors (e.g. Delhi - Mumbai corridor)
  'jaipur': { latitude: 26.9124, longitude: 75.7873 },
  'kota': { latitude: 25.2138, longitude: 75.8648 },
  'udaipur': { latitude: 24.5854, longitude: 73.7125 },
  'ratlam': { latitude: 23.3315, longitude: 75.0367 },
  'indore': { latitude: 22.7196, longitude: 75.8577 },
  'vadodara': { latitude: 22.3072, longitude: 73.1812 },
  'baroda': { latitude: 22.3072, longitude: 73.1812 },
  'barodra': { latitude: 22.3072, longitude: 73.1812 },
  'ahmedabad': { latitude: 23.0225, longitude: 72.5714 },
  'surat': { latitude: 21.1702, longitude: 72.8311 },
  'vapi': { latitude: 20.3893, longitude: 72.9106 },
  'mumbai': { latitude: 19.076, longitude: 72.8777 },
  'pune': { latitude: 18.5204, longitude: 73.8567 },
  'chandigarh': { latitude: 30.7333, longitude: 76.7794 },
  'agra': { latitude: 27.1767, longitude: 78.0081 },
  'mathura': { latitude: 27.4924, longitude: 77.6737 },
  'gwalior': { latitude: 26.2183, longitude: 78.1828 },
  'bhopal': { latitude: 23.2599, longitude: 77.4126 },
  'kanpur': { latitude: 26.4499, longitude: 80.3319 },
  'lucknow': { latitude: 26.8467, longitude: 80.9462 },
  'bangalore': { latitude: 12.9716, longitude: 77.5946 },
  'bengaluru': { latitude: 12.9716, longitude: 77.5946 },
  'hyderabad': { latitude: 17.385, longitude: 78.4867 },
  'chennai': { latitude: 13.0827, longitude: 80.2707 },
  'kolkata': { latitude: 22.5726, longitude: 88.3639 },
};

/**
 * Resolves coordinates for a place name using substring matching against the built-in catalog.
 */
export function resolveLocationCoordinates(placeName: string): Coordinates | null {
  if (!placeName || typeof placeName !== 'string') return null;
  const clean = placeName.trim().toLowerCase();

  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (clean === key || clean.includes(key) || key.includes(clean)) {
      return coords;
    }
  }
  return null;
}

/**
 * Converts degrees to radians.
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates the great-circle distance between two points on Earth using the Haversine formula.
 * @returns Distance in kilometers.
 */
export function calculateHaversineDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const dLat = toRadians(coord2.latitude - coord1.latitude);
  const dLon = toRadians(coord2.longitude - coord1.longitude);

  const lat1 = toRadians(coord1.latitude);
  const lat2 = toRadians(coord2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Calculates cross-track distance (perpendicular distance) from a point to a great-circle path.
 * Determines how far a pickup or dropoff point is from the straight/corridor path of the driver.
 */
export function calculateCrossTrackDistance(
  point: Coordinates,
  start: Coordinates,
  end: Coordinates
): number {
  const d13 = calculateHaversineDistance(start, point) / EARTH_RADIUS_KM;
  const brg13 = calculateBearing(start, point);
  const brg12 = calculateBearing(start, end);

  return (
    Math.abs(Math.asin(Math.sin(d13) * Math.sin(brg13 - brg12))) *
    EARTH_RADIUS_KM
  );
}

/**
 * Calculates initial bearing from point 1 to point 2 in radians.
 */
function calculateBearing(p1: Coordinates, p2: Coordinates): number {
  const lat1 = toRadians(p1.latitude);
  const lat2 = toRadians(p2.latitude);
  const dLon = toRadians(p2.longitude - p1.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return Math.atan2(y, x);
}

/**
 * Calculates along-track distance from start to the point projected onto path start -> end.
 */
export function calculateAlongTrackDistance(
  point: Coordinates,
  start: Coordinates,
  end: Coordinates
): number {
  const d13 = calculateHaversineDistance(start, point) / EARTH_RADIUS_KM;
  const dxt = calculateCrossTrackDistance(point, start, end) / EARTH_RADIUS_KM;

  const ratio = Math.cos(d13) / Math.cos(dxt);
  const clampedRatio = Math.max(-1, Math.min(1, ratio));

  return Math.acos(clampedRatio) * EARTH_RADIUS_KM;
}

/**
 * Checks if a passenger's sub-trip (riderPickup -> riderDropoff) lies along the driver's route (driverSource -> driverDest).
 *
 * Requirements:
 * 1. Both rider pickup & dropoff must be within `maxDetourKm` (default 50 km for intercity highway corridors, 8 km for city) perpendicular to the driver's corridor.
 * 2. Rider pickup must occur before rider dropoff along the driver's route trajectory.
 * 3. Returns the rider's sub-trip distance in kilometers and the driver's total distance in kilometers.
 */
export function matchRouteCorridor(
  driverSource: Coordinates,
  driverDest: Coordinates,
  riderPickup: Coordinates,
  riderDropoff: Coordinates,
  maxDetourKm?: number
): {
  isMatch: boolean;
  riderDistanceKm: number;
  driverTotalDistanceKm: number;
  detourPickupKm: number;
  detourDropoffKm: number;
} {
  const driverTotalDistanceKm = calculateHaversineDistance(
    driverSource,
    driverDest
  );

  if (driverTotalDistanceKm < 0.5) {
    return {
      isMatch: false,
      riderDistanceKm: 0,
      driverTotalDistanceKm,
      detourPickupKm: 0,
      detourDropoffKm: 0,
    };
  }

  // Adaptive detour threshold: for long interstate routes (e.g. 500-1400km), allow up to 100km corridor buffer; for city routes, 15km
  const effectiveMaxDetour =
    maxDetourKm !== undefined
      ? maxDetourKm
      : driverTotalDistanceKm > 300
      ? 100.0
      : 15.0;

  const detourPickupKm = calculateCrossTrackDistance(
    riderPickup,
    driverSource,
    driverDest
  );
  const detourDropoffKm = calculateCrossTrackDistance(
    riderDropoff,
    driverSource,
    driverDest
  );

  const pickupAlong = calculateAlongTrackDistance(
    riderPickup,
    driverSource,
    driverDest
  );
  const dropoffAlong = calculateAlongTrackDistance(
    riderDropoff,
    driverSource,
    driverDest
  );

  // 1. Both points within corridor detour limit
  const withinCorridor =
    detourPickupKm <= effectiveMaxDetour && detourDropoffKm <= effectiveMaxDetour;

  // 2. Rider pickup must occur before rider dropoff along driver's path
  const correctDirection =
    pickupAlong >= -10.0 &&
    dropoffAlong <= driverTotalDistanceKm + 15.0 &&
    dropoffAlong > pickupAlong;

  const riderDistanceKm = calculateHaversineDistance(
    riderPickup,
    riderDropoff
  );

  const isMatch = withinCorridor && correctDirection;

  return {
    isMatch,
    riderDistanceKm: Math.round(riderDistanceKm * 10) / 10,
    driverTotalDistanceKm: Math.round(driverTotalDistanceKm * 10) / 10,
    detourPickupKm: Math.round(detourPickupKm * 10) / 10,
    detourDropoffKm: Math.round(detourDropoffKm * 10) / 10,
  };
}
