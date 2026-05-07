import { Router, Request, Response } from 'express';
import { getCache } from '../cache/store';
import { getSlice, getRotationNumber } from '../cache/rotation';
import { ContentResponse, SlideDefinition, StatusResponse } from '../types';

const router = Router();

let isOnline = false;
export function setOnlineStatus(online: boolean): void {
  isOnline = online;
}

router.get('/status', (_req: Request, res: Response) => {
  const cache = getCache();
  const response: StatusResponse = {
    online: isOnline,
    lastRefresh: cache.lastRefresh,
  };
  res.json(response);
});

router.get('/content', (_req: Request, res: Response) => {
  const cache = getCache();
  const slides: SlideDefinition[] = [];

  // Slide 1: Weather
  slides.push({
    id: 'weather',
    type: 'weather',
    label: 'Weerbericht',
    weather: cache.weather ?? undefined,
  });

  // Slide 2: Buienradar
  slides.push({
    id: 'buienradar',
    type: 'buienradar',
    label: 'Buienradar',
  });

  // Slides 3–6: Schuttevaer (4 rotating articles)
  const schuttevaerIndices = getSlice('schuttevaer', cache.schuttevaer.length, 4);
  schuttevaerIndices.forEach((idx, i) => {
    const article = cache.schuttevaer[idx];
    if (article) {
      slides.push({
        id: `schuttevaer-${i}`,
        type: 'news',
        label: 'Schuttevaer',
        article,
      });
    }
  });

  // Slide 7: Traffic (configurable via TRAFFIC_FROM, default 15:30)
  const trafficFrom = process.env.TRAFFIC_FROM ?? '15:30';
  const [tfH, tfM] = trafficFrom.split(':').map(Number);
  const now = new Date();
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  const showTraffic = minuteOfDay >= tfH * 60 + (tfM || 0);
  if (showTraffic) {
    slides.push({
      id: 'traffic',
      type: 'traffic',
      label: 'Verkeersinformatie',
      traffic: cache.traffic ?? undefined,
    });
  }

  // Slide 13: Status (only when online) — served through local proxy for auto-auth
  if (isOnline && process.env.STATUS_URL) {
    slides.push({
      id: 'Status',
      type: 'iframe',
      label: 'Status',
      iframeUrl: '/proxy/Status/',
    });
  }

  // Slide 14: Traffic Viewer — served through local proxy for auto-auth
  if (process.env.TRAFFIC_VIEWER_URL) {
    slides.push({
      id: 'traffic-viewer',
      type: 'iframe',
      label: 'Traffic Viewer',
      iframeUrl: '/proxy/traffic/',
    });
  }

  // Slides 15–18: NOS (4 rotating)
  const nosIndices = getSlice('nos', cache.nos.length, 4);
  nosIndices.forEach((idx, i) => {
    const article = cache.nos[idx];
    if (article) {
      slides.push({
        id: `nos-${i}`,
        type: 'news',
        label: 'NOS Nieuws',
        article,
      });
    }
  });

  // Slides 19–21: Pipedrive placeholders
  ['Deals overzicht', 'Activiteiten', 'Pipeline status'].forEach((title, i) => {
    slides.push({
      id: `pipedrive-${i}`,
      type: 'placeholder',
      label: 'Pipedrive CRM',
      placeholderTitle: title,
      placeholderIcon: ['💼', '📅', '📊'][i],
    });
  });

  const response: ContentResponse = {
    slides,
    rotation: getRotationNumber(),
    generatedAt: new Date().toISOString(),
  };

  res.json(response);
});

export default router;
