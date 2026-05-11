import fs from 'fs';
import path from 'path';
import { CacheStore } from '../types';

const CACHE_FILE = path.resolve(process.env.CACHE_DIR || './cache', 'content.json');

const defaultStore: CacheStore = {
  weather: null,
  schuttevaer: [],
  nos: [],
  bnr: [],
  traffic: null,
  flitsers: null,
  spits: null,
  lastRefresh: null,
};

let memory: CacheStore = { ...defaultStore };

export function loadCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      memory = { ...defaultStore, ...JSON.parse(raw) };
      console.log('[cache] Loaded from disk:', CACHE_FILE);
    }
  } catch (err) {
    console.warn('[cache] Failed to load cache file, starting fresh:', err);
  }
}

export function saveCache(): void {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(memory, null, 2), 'utf-8');
  } catch (err) {
    console.error('[cache] Failed to save cache:', err);
  }
}

export function getCache(): CacheStore {
  return memory;
}

export function updateCache(partial: Partial<CacheStore>): void {
  memory = { ...memory, ...partial, lastRefresh: new Date().toISOString() };
  saveCache();
}

export function isCacheStale(maxAgeMinutes = 35): boolean {
  if (!memory.lastRefresh) return true;
  const age = Date.now() - new Date(memory.lastRefresh).getTime();
  return age > maxAgeMinutes * 60 * 1000;
}
