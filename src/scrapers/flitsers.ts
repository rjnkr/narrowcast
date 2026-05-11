import { FlitsData, Flitser } from '../types';

const PAGE_URL = 'https://www.anwb.nl/verkeer/flitsers';

const APELDOORN_LAT = 52.22;
const APELDOORN_LON = 5.97;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getBuildId(): Promise<string> {
  const res = await fetch(PAGE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(10000),
  });
  const html = await res.text();
  const match = html.match(/"buildId":"([^"]+)"/);
  if (!match) throw new Error('[flitsers] Could not find ANWB buildId');
  return match[1];
}

export async function fetchFlitsers(): Promise<FlitsData> {
  const buildId = await getBuildId();
  const url = `https://www.anwb.nl/_next/data/${buildId}/verkeer/flitsers.json`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`[flitsers] ANWB fetch error ${res.status}`);

  const data = await res.json() as any;
  const loaderData = data?.pageProps?.loaderData ?? {};

  // Robustly find the component with roads data
  let roads: any[] = [];
  for (const componentId of Object.keys(loaderData)) {
    const queries = loaderData[componentId]?.dehydratedState?.queries ?? [];
    for (const q of queries) {
      if (Array.isArray(q?.state?.data?.roads)) {
        roads = q.state.data.roads;
        break;
      }
    }
    if (roads.length) break;
  }

  const flitsers: Flitser[] = [];
  for (const road of roads) {
    for (const segs of road.segments ?? []) {
      for (const seg of segs) {
        if (seg.category === 'radars' || seg.incidentType === 'radar') {
          const directionCity = seg.codeDirection === 1
            ? (seg.segment?.end || seg.to)
            : (seg.segment?.start || seg.from);
          const lat: number | undefined = seg.lat ?? seg.latitude ?? seg.location?.lat ?? seg.coordinates?.lat;
          const lon: number | undefined = seg.lon ?? seg.lng ?? seg.longitude ?? seg.location?.lon ?? seg.location?.lng ?? seg.coordinates?.lon;
          const dist = (lat != null && lon != null)
            ? parseFloat(haversineKm(APELDOORN_LAT, APELDOORN_LON, lat, lon).toFixed(1))
            : undefined;
          flitsers.push({
            id: seg.id,
            road: seg.road,
            from: seg.from || '',
            to: seg.to || '',
            hm: seg.HM,
            direction: directionCity ? `richting ${directionCity}` : '',
            lat,
            lon,
            distanceFromApeldoorn: dist,
          });
        }
      }
    }
  }

  flitsers.sort((a, b) => (a.distanceFromApeldoorn ?? 999) - (b.distanceFromApeldoorn ?? 999));
  console.log(`[flitsers] ${flitsers.length} speed cameras fetched`);
  return { flitsers, fetchedAt: new Date().toISOString() };
}
