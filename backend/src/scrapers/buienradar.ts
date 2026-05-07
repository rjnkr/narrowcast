import fs from 'fs';
import path from 'path';

const RADAR_URL = 'https://api.buienradar.nl/image/1.0/RadarMapNL?w=820&h=512';
const CACHE_PATH = path.resolve(process.env.CACHE_DIR || './cache', 'buienradar.gif');

export async function fetchBuienradar(): Promise<void> {
  const res = await fetch(RADAR_URL);
  if (!res.ok) throw new Error(`Buienradar fetch error: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_PATH, buf);
  console.log('[buienradar] Radar image cached');
}

export function getBuienradarCachePath(): string {
  return CACHE_PATH;
}

export function hasCachedBuienradar(): boolean {
  return fs.existsSync(CACHE_PATH);
}
