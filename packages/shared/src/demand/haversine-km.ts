// Great-circle distance between two lat/lng points (Issue 13).
//
// Used as the distance tiebreaker in the best-offer solver (#13): when two
// offer combinations tie on total cost, the one with the smaller total
// distance (buyer → each pickup, weighted by quantity) wins. Pure — no I/O,
// no rounding beyond IEEE-754. R = 6371 km (Earth mean radius), matching the
// standard Haversine formula. See CONTEXT.md "Best Offer" (Haversine).

/// Great-circle distance in kilometers between (lat1,lng1) and (lat2,lng2).
/// Returns 0 for identical points. Inputs are degrees (lat −90..90, lng
/// −180..180); validation is the caller's job — the demand/offer CHECK
/// constraints already enforce the ranges at the DB layer.
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth mean radius, km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
