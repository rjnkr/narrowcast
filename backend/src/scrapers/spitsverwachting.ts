import { SpitsData, SpitsVerwachting } from '../types';

const API_URL = 'https://api.rwsverkeersinfo.nl/api/peakexpectations/';

export async function fetchSpitsverwachting(): Promise<SpitsData> {
  const res = await fetch(API_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`[spits] RWS fetch error ${res.status}`);

  const data = await res.json() as any;
  const predictions: SpitsVerwachting[] = (data.results ?? []).map((r: any) => ({
    date: r.date,
    daypart: r.daypart,
    severity: r.severity,
    severityExplanation: r.severity_explanation ?? '',
    content: r.content ?? '',
    moments: (r.moments ?? []).map((m: any) => ({
      time: m.time,
      expected: m.expected ?? 0,
      average: m.average ?? 0,
    })),
  }));

  console.log(`[spits] ${predictions.length} predictions fetched`);
  return { predictions, fetchedAt: new Date().toISOString() };
}
