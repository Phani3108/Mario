const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in meters using the haversine formula. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function isInsideGeofence(
  site: { lat: number; lng: number; radiusM: number },
  point: { lat: number; lng: number },
): boolean {
  return haversineMeters(site, point) <= site.radiusM;
}
