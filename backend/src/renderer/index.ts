import fs from 'fs';
import path from 'path';
import { getCache } from '../cache/store';
import { getSlice, getRotationNumber } from '../cache/rotation';
import { renderWeather } from './weather';
import { renderBuienradar } from './buienradar';
import { renderNews } from './news';
import { renderTraffic } from './traffic';
import { renderFlitsers } from './flitsers';
import { renderPlaceholder } from './placeholder';

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

export function renderSlides(): void {
  if (!fs.existsSync(SLIDES_DIR)) {
    fs.mkdirSync(SLIDES_DIR, { recursive: true });
  }

  const cache = getCache();
  const slides: ManifestSlide[] = [];

  // Traffic Viewer — direct iframe, no framing restrictions
  if (process.env.TRAFFIC_VIEWER_URL) {
    slides.push({ id: 'traffic-viewer', label: 'Traffic Viewer', url: process.env.TRAFFIC_VIEWER_URL, persistent: true });
  }

  // Status — direct iframe, requires allow_embedding = true in Status.ini
  if (process.env.STATUS_URL) {
    slides.push({ id: 'status', label: 'Status', url: process.env.STATUS_URL, persistent: true });
  }

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
  const [tfH, tfM] = trafficFrom.split(':').map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() >= tfH * 60 + (tfM || 0)) {
    write('traffic.html', renderTraffic(cache.traffic));
    slides.push({ id: 'traffic', label: 'Verkeersinformatie', url: '/slides/traffic.html', duration: 60000 });
  }

  // Flitsers + Spitsverwachting (after traffic, same time gate)
  if (now.getHours() * 60 + now.getMinutes() >= tfH * 60 + (tfM || 0)) {
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

  // Pipedrive placeholders
  const placeholders: [string, string][] = [
    ['Deals overzicht', '💼'],
    ['Activiteiten',    '📅'],
    ['Pipeline status', '📊'],
  ];
  placeholders.forEach(([title, icon], i) => {
    write(`pipedrive-${i}.html`, renderPlaceholder(title, icon));
    slides.push({ id: `pipedrive-${i}`, label: 'Pipedrive CRM', url: `/slides/pipedrive-${i}.html` });
  });

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
