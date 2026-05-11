import fs from 'fs';
import path from 'path';
import { getCache } from '../cache/store';
import { getSlice, getRotationNumber } from '../cache/rotation';
import { renderWeather } from './weather';
import { renderBuienradar } from './buienradar';
import { renderNews } from './news';
import { renderTraffic } from './traffic';
import { renderFlitsers } from './flitsers';

const SLIDES_DIR = path.resolve(process.env.CACHE_DIR || './cache', 'slides');

export interface ManifestSlide {
  id: string;
  label: string;
  url: string;
  persistent?: boolean;
  duration?: number;  // ms — overrides the default 20 s when set
}

export interface Manifest {
  slides: ManifestSlide[];
  rotation: number;
  generatedAt: string;
}

function write(filename: string, html: string): void {
  fs.writeFileSync(path.join(SLIDES_DIR, filename), html, 'utf8');
}

interface SectionSlideConfig {
  url: string;
  label: string;
  duration?: number;  // ms, default 20 000
  from?: string;      // HH:MM — only show from this time; omit = always
}

function parseSectionSlides(envVar: string): SectionSlideConfig[] {
  const configPath = process.env[envVar]?.trim();
  if (!configPath) return [];   // not configured — silently skip
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    console.warn(`[renderer] ${envVar}: file not found — ${resolved}, skipping slides`);
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    if (!Array.isArray(parsed)) {
      console.warn(`[renderer] ${envVar}: expected a JSON array, skipping slides`);
      return [];
    }
    return parsed.filter((s: any) => typeof s.url === 'string' && s.url);
  } catch (e) {
    console.warn(`[renderer] ${envVar}: parse error —`, (e as Error).message, '— skipping slides');
    return [];
  }
}

function minuteOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function addSectionSlides(
  slides: ManifestSlide[],
  configs: SectionSlideConfig[],
  prefix: string,
  nowMinutes: number,
): void {
  configs.forEach((cfg, i) => {
    if (cfg.from && nowMinutes < minuteOfDay(cfg.from)) return;
    slides.push({
      id: `${prefix}-${i}`,
      label: cfg.label,
      url: cfg.url,
      persistent: true,
      ...(cfg.duration ? { duration: cfg.duration } : {}),
    });
  });
}

export function renderSlides(): void {
  if (!fs.existsSync(SLIDES_DIR)) {
    fs.mkdirSync(SLIDES_DIR, { recursive: true });
  }

  const cache = getCache();
  const slides: ManifestSlide[] = [];
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // ── Section 1 (e.g. Traffic Viewer, Status) ──────────────────────────────────
  addSectionSlides(slides, parseSectionSlides('SLIDES_SECTION1_CONFIG'), 'section1', nowMinutes);

  // Schuttevaer (4 rotating)
  const svIndices = getSlice('schuttevaer', cache.schuttevaer.length, 4);
  svIndices.forEach((idx, i) => {
    const a = cache.schuttevaer[idx];
    if (a) {
      write(`schuttevaer-${i}.html`, renderNews(a, 'Schuttevaer'));
      slides.push({ id: `schuttevaer-${i}`, label: 'Schuttevaer', url: `/slides/schuttevaer-${i}.html` });
    }
  });

  // Traffic (time-gated)
  const trafficFrom = process.env.TRAFFIC_FROM ?? '15:30';
  if (nowMinutes >= minuteOfDay(trafficFrom)) {
    write('traffic.html', renderTraffic(cache.traffic));
    slides.push({ id: 'traffic', label: 'Verkeersinformatie', url: '/slides/traffic.html', duration: 60000 });
  }

  // Flitsers + Spitsverwachting (after traffic, same time gate)
  if (nowMinutes >= minuteOfDay(trafficFrom)) {
    write('flitsers.html', renderFlitsers(cache.flitsers, cache.spits));
    slides.push({ id: 'flitsers', label: 'Flitsers & Spitsverwachting', url: '/slides/flitsers.html' });
  }

  // Buienradar
  write('buienradar.html', renderBuienradar());
  slides.push({ id: 'buienradar', label: 'Buienradar', url: '/slides/buienradar.html' });

  // Weather
  write('weather.html', renderWeather(cache.weather));
  slides.push({ id: 'weather', label: 'Weerbericht', url: '/slides/weather.html' });

  // NOS (4 rotating)
  const nosIndices = getSlice('nos', cache.nos.length, 4);
  nosIndices.forEach((idx, i) => {
    const a = cache.nos[idx];
    if (a) {
      write(`nos-${i}.html`, renderNews(a, 'NOS Nieuws'));
      slides.push({ id: `nos-${i}`, label: 'NOS Nieuws', url: `/slides/nos-${i}.html` });
    }
  });

  // ── Section 2 (e.g. Pipedrive, internal dashboards) ──────────────────────────
  addSectionSlides(slides, parseSectionSlides('SLIDES_SECTION2_CONFIG'), 'section2', nowMinutes);

  // BNR — 3 most recent articles (no rotation, always freshest)
  cache.bnr.slice(0, 3).forEach((a, i) => {
    write(`bnr-${i}.html`, renderNews(a, 'BNR Nieuwsradio'));
    slides.push({ id: `bnr-${i}`, label: 'BNR Nieuwsradio', url: `/slides/bnr-${i}.html` });
  });

  const manifest: Manifest = {
    slides,
    rotation: getRotationNumber(),
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(SLIDES_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`[renderer] ${slides.length} slides rendered`);
}
