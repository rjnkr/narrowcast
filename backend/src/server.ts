import dotenv from 'dotenv';
import path from 'path';
// Load .env from project root (one level above backend/)
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config(); // also try backend/.env as local override
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { loadCache, updateCache, getCache } from './cache/store';
import { pruneImages } from './cache/images';
import { loadRotation } from './cache/rotation';
import { fetchWeather } from './scrapers/weather';
import { fetchBuienradar } from './scrapers/buienradar';
import { fetchSchuttevaer } from './scrapers/schuttevaer';
import { fetchBnr } from './scrapers/bnr';
import { fetchNos } from './scrapers/nos';
import { fetchTraffic } from './scrapers/traffic';
import { fetchFlitsers } from './scrapers/flitsers';
import { fetchSpitsverwachting } from './scrapers/spitsverwachting';
import { fetchVerkeerplazaMap } from './scrapers/verkeerplaza';
import { renderSlides } from './renderer';
import apiRouter, { setOnlineStatus } from './routes/api';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const CACHE_DIR = process.env.CACHE_DIR || './cache';

app.use(cors());
app.use(express.json());

// Serve cached images and pre-rendered slide HTML
app.use('/static', express.static(path.resolve(CACHE_DIR)));
app.use('/slides', (req, res, next) => {
  if (req.path === '/manifest.json') {
    res.setHeader('Cache-Control', 'no-cache, no-store');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=900');
  }
  next();
}, express.static(path.resolve(CACHE_DIR, 'slides')));

app.use('/api', apiRouter);

function ts(): string {
  return new Date().toLocaleTimeString('nl-NL', { hour12: false });
}

function log(tag: string, msg: string): void {
  console.log(`[${ts()}] ${tag} ${msg}`);
}

function err(tag: string, msg: string, e?: unknown): void {
  console.error(`[${ts()}] ${tag} ERROR — ${msg}`, e ?? '');
}

async function checkOnline(): Promise<boolean> {
  try {
    const res = await fetch('https://www.tidalis.com', {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function run<T>(
  label: string,
  fn: () => Promise<T>,
  onSuccess: (result: T) => void
): Promise<boolean> {
  try {
    const result = await fn();
    onSuccess(result);
    return true;
  } catch (e) {
    err(label, 'scrape failed', e);
    return false;
  }
}

const WEATHER_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

function isWeatherStale(): boolean {
  const fetchedAt = getCache().weather?.fetchedAt;
  if (!fetchedAt) return true;
  return Date.now() - new Date(fetchedAt).getTime() >= WEATHER_INTERVAL_MS;
}

async function runAllScrapers(): Promise<void> {
  log('[scraper]', 'Starting full refresh...');

  const weatherStale = isWeatherStale();
  if (!weatherStale) log('[weather]  ', 'Skipped — fetched less than 60 min ago');

  const results = await Promise.allSettled([
    weatherStale
      ? run('weather    ', () => fetchWeather(), (w) => {
          updateCache({ weather: w });
          log('[weather]  ', `OK — ${w.days.length} days fetched`);
        })
      : Promise.resolve(true),
    run('buienradar ', () => fetchBuienradar(), () => {
      log('[buienradar]', 'OK — radar image updated');
    }),
    run('schuttevaer', () => fetchSchuttevaer(), (a) => {
      updateCache({ schuttevaer: a });
      log('[schuttev] ', `OK — ${a.length} articles, ${a.filter(x => x.imageUrl?.startsWith('/static')).length} images cached`);
    }),
    run('bnr        ', () => fetchBnr(), (a) => {
      updateCache({ bnr: a });
      log('[bnr]      ', `OK — ${a.length} articles, ${a.filter(x => x.imageUrl?.startsWith('/static')).length} images cached`);
    }),
    run('nos        ', () => fetchNos(), (a) => {
      updateCache({ nos: a });
      log('[nos]      ', `OK — ${a.length} articles, ${a.filter(x => x.imageUrl?.startsWith('/static')).length} images cached`);
    }),
    run('traffic    ', () => fetchTraffic(), (t) => {
      updateCache({ traffic: t });
      log('[traffic]  ', `OK — ${t.jams.length} jams`);
    }),
    run('flitsers   ', () => fetchFlitsers(), (f) => {
      updateCache({ flitsers: f });
      log('[flitsers] ', `OK — ${f?.flitsers?.length ?? 0} speed cameras`);
    }),
    run('spits      ', () => fetchSpitsverwachting(), (s) => {
      updateCache({ spits: s });
      log('[spits]    ', `OK — ${s?.predictions?.length ?? 0} predictions`);
    }),
    run('verkeerplaza', () => fetchVerkeerplazaMap(), () => {
      log('[verkeerplaza]', 'OK — map screenshot saved');
    }),
  ]);

  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === false)).length;
  if (failed > 0) {
    log('[scraper]', `${failed} scraper(s) failed (see errors above)`);
  }

  // Prune images no longer referenced by any cached article
  const cache = getCache();
  const activeImages = new Set<string>();
  for (const article of [...cache.schuttevaer, ...cache.nos]) {
    if (article.imageUrl?.startsWith('/static/')) activeImages.add(article.imageUrl);
  }
  pruneImages(activeImages);

  renderSlides();
  log('[scraper]', 'Refresh complete ✓');
}

async function refreshIfOnline(): Promise<void> {
  const online = await checkOnline();
  setOnlineStatus(online);
  if (online) {
    log('[network]', 'Online — starting scrape');
    await runAllScrapers();
  } else {
    log('[network]', 'Offline — skipping scrape, rendering from cache');
    renderSlides();
  }
}

async function bootstrap(): Promise<void> {
  log('[server]', 'Starting Tidalis Narrowcast backend...');
  loadCache();
  loadRotation();

  // Always refresh on startup; serve from cache if offline
  await refreshIfOnline();

  // Full refresh every 10 minutes
  cron.schedule('*/10 * * * *', () => {
    log('[cron]', 'Scheduled refresh triggered');
    refreshIfOnline().catch((e) => err('[cron]', 'Refresh failed', e));
  });

  app.listen(PORT, () => {
    log('[server]', `Listening on port ${PORT}`);
  });
}

bootstrap().catch((e) => {
  err('[server]', 'Fatal error during startup', e);
  process.exit(1);
});
