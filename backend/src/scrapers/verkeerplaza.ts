import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CACHE_PATH = path.resolve(process.env.CACHE_DIR || './cache', 'verkeerplaza-map.png');
const PAGE_URL = 'https://www.verkeerplaza.nl';

export async function fetchVerkeerplazaMap(): Promise<void> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    // 1280×900 viewport — wide enough for the full desktop layout
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36');

    // Block ads, trackers, and the Didomi consent SDK so the popup never appears
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      const blocked = [
        'privacy-center.org',  // Didomi consent SDK
        'consent.js',          // verkeerplaza consent loader
        'didomi',
        'googlesyndication', 'doubleclick', 'adservice',
        'googletagmanager', 'facebook', 'ads.js',
      ];
      if (blocked.some(b => url.includes(b))) req.abort();
      else req.continue();
    });

    await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 45000 });

    // Wait for the Leaflet map container to appear and tiles to render
    await page.waitForSelector('#mapcontainer .leaflet-tile-loaded', { timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));

    // Pan to Apeldoorn — try Leaflet internals then fall back to global scan
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — runs in browser context via Puppeteer, DOM globals are valid
    await page.evaluate(() => {
      const APELDOORN: [number, number] = [52.22, 5.97];
      const ZOOM = 9;
      // @ts-ignore
      const L = (window as any).L;
      // @ts-ignore
      const leafletEl = document.querySelector('.leaflet-container') as any;
      if (leafletEl?._leaflet_id && L?.Map?._instances?.[leafletEl._leaflet_id]) {
        L.Map._instances[leafletEl._leaflet_id].setView(APELDOORN, ZOOM);
        return;
      }
      // @ts-ignore
      for (const key of Object.keys(window as any)) {
        try {
          // @ts-ignore
          const v = (window as any)[key];
          if (v && typeof v.setView === 'function' && typeof v.getZoom === 'function') {
            v.setView(APELDOORN, ZOOM);
            return;
          }
        } catch { /* skip non-enumerable or throwing properties */ }
      }
    });

    // Wait for the new tile set to render after panning
    await page.waitForSelector('#mapcontainer .leaflet-tile-loaded', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 2500));

    const mapEl = await page.$('#mapcontainer');
    if (!mapEl) throw new Error('[verkeerplaza] #mapcontainer not found');

    const dir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await mapEl.screenshot({ path: CACHE_PATH });
    console.log('[verkeerplaza] Map screenshot saved');
  } catch (err) {
    console.error('[verkeerplaza] Screenshot error:', (err as Error).message);
  } finally {
    await browser?.close();
  }
}

export function hasVerkeerplazaMap(): boolean {
  return fs.existsSync(CACHE_PATH);
}
