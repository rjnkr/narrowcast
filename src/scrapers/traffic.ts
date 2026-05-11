import { TrafficData, TrafficJam } from '../types';

const APELDOORN_LAT = 52.22;
const APELDOORN_LON = 5.97;

const API_KEY = 'verkeerplaza-web-dcc819b6-b1f3-45c9-ad17-eeeacb9fe634';
const GEO_URL = `https://apisupport.infoplaza.nl/traffic/v1/geo?key=${API_KEY}`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface GeoFeature {
  id: string;
  geometry: { type: string; coordinates: number[][] };
  properties: {
    RoadNumber: string;
    FromLocation: string;
    ToLocation: string;
    cause: string;
    causeType: string;
    description: string;
  };
}

export async function fetchTraffic(): Promise<TrafficData> {
  try {
    const res = await fetch(GEO_URL, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`Infoplaza API ${res.status}`);

    const geojson = await res.json() as { features: GeoFeature[] };
    const jams: TrafficJam[] = [];

    for (const feature of geojson.features) {
      const p = feature.properties;
      const rawCoords: unknown[] = feature.geometry?.coordinates ?? [];

      // GeoJSON is [lon, lat] — flip to Leaflet [lat, lon]; skip non-array elements
      const coordinates: [number, number][] = rawCoords
        .filter((c): c is number[] => Array.isArray(c) && c.length >= 2)
        .map(c => [c[1], c[0]]);

      // Centre point for distance sorting
      const mid = (rawCoords[Math.floor(rawCoords.length / 2)] ?? rawCoords[0] ?? [0, 0]) as any;
      const lat = mid[1];
      const lon = mid[0];
      const dist = haversineKm(APELDOORN_LAT, APELDOORN_LON, lat, lon);

      jams.push({
        id: feature.id,
        road: p.RoadNumber ?? '',
        from: p.FromLocation ?? '',
        to: p.ToLocation ?? '',
        reason: [p.cause, p.description].filter(Boolean).join(' — '),
        causeType: p.causeType ?? 'unknown',
        lat,
        lon,
        coordinates,
        distanceFromApeldoorn: parseFloat(dist.toFixed(1)),
      });
    }

    jams.sort((a, b) => (a.distanceFromApeldoorn ?? 999) - (b.distanceFromApeldoorn ?? 999));
    console.log(`[traffic] ${jams.length} incidents from Infoplaza`);
    return { jams: jams.slice(0, 30), fetchedAt: new Date().toISOString() };
  } catch (err) {
    console.error('[traffic] Error:', (err as Error).message);
    return { jams: [], fetchedAt: new Date().toISOString() };
  }
}
