import { FlitsData, Flitser } from '../types';

const PAGE_URL = 'https://www.anwb.nl/verkeer/flitsers';

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
          flitsers.push({
            id: seg.id,
            road: seg.road,
            from: seg.from || '',
            to: seg.to || '',
            hm: seg.HM,
            direction: directionCity ? `richting ${directionCity}` : '',
          });
        }
      }
    }
  }

  console.log(`[flitsers] ${flitsers.length} speed cameras fetched`);
  return { flitsers, fetchedAt: new Date().toISOString() };
}
