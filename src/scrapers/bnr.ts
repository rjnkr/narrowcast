import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteerExtra.use(StealthPlugin());
import { NewsArticle } from '../types';
import crypto from 'crypto';

const LIST_URL = 'https://www.bnr.nl/nieuws';

export async function fetchBnr(): Promise<NewsArticle[]> {
  let browser;
  try {
    browser = await puppeteerExtra.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36');

    // Block ads and trackers to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      const url = req.url();
      if (['font', 'media'].includes(type)) { req.abort(); return; }
      if (/googlesyndication|doubleclick|googletagmanager|facebook|didomi|consent/i.test(url)) {
        req.abort(); return;
      }
      req.continue();
    });

    await page.goto(LIST_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Extract first 3 article links from the list page
    // @ts-ignore — runs in browser context via Puppeteer
    const articleLinks: string[] = await page.evaluate(() => {
      // @ts-ignore
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      const seen = new Set();
      const links: string[] = [];
      for (const a of anchors as any[]) {
        const href = a.getAttribute('href') ?? '';
        if (/^\/nieuws\/.+\/.+/.test(href) && !seen.has(href)) {
          seen.add(href);
          links.push(href);
          if (links.length === 3) break;
        }
      }
      return links;
    });

    if (articleLinks.length === 0) {
      console.warn('[bnr] No article links found on list page');
      return [];
    }

    // For each article, load the page and extract metadata + full-quality og:image
    const articles: NewsArticle[] = [];
    for (const path of articleLinks) {
      try {
        const url = `https://www.bnr.nl${path}`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        // Wait for Cloudflare challenge to clear — article h1 must be present
        // @ts-ignore — runs in browser context via Puppeteer
        await page.waitForFunction(
          // @ts-ignore
          () => document.title !== 'Just a moment...' && !!document.querySelector('h1'),
          { timeout: 20000 }
        );

        // @ts-ignore — runs in browser context via Puppeteer
        const meta: { title: string; summary: string; imageUrl: string; _titleQuery: string; _ogTitle: string; _docTitle: string } = await page.evaluate(() => {
          // @ts-ignore
          const og = (prop: string) => (document.querySelector(`meta[property="${prop}"]`) as any)?.content ?? '';
          // @ts-ignore
          const lead = (document.querySelector('.article__lead, .lead, [class*="lead"], [class*="intro"]') as any)?.innerText ?? '';
          // @ts-ignore
          const _titleQuery = (document.querySelector('h1, [class*="title"], [class*="headline"]') as any)?.innerText ?? '';
          // @ts-ignore
          const _ogTitle = og('og:title');
          // @ts-ignore
          const _docTitle = document.title;
          const title = _ogTitle || _docTitle;

          // Prefer <figure> img srcset (highest resolution) over og:image
          // @ts-ignore
          const figImg = document.querySelector('figure img') as any;
          let imageUrl = og('og:image');
          if (figImg) {
            const srcset: string = figImg.getAttribute('srcset') ?? '';
            if (srcset) {
              // Parse "url 400w, url 800w" — pick highest width
              const best = srcset.split(',')
                .map((s: string) => { const [u, w] = s.trim().split(/\s+/); return { url: u, w: parseInt(w) || 0 }; })
                .sort((a: any, b: any) => b.w - a.w)[0];
              if (best?.url) imageUrl = best.url;
            } else {
              imageUrl = figImg.getAttribute('src') || imageUrl;
            }
          }

          return { title, summary: og('og:description') || lead, imageUrl, _titleQuery, _ogTitle, _docTitle };
        });

        const imageUrl: string | undefined = meta.imageUrl || undefined;

        articles.push({
          id: crypto.createHash('md5').update(url).digest('hex'),
          source: 'bnr',
          title: meta.title.replace(/\s*[-|]\s*BNR.*$/i, '').trim(),
          summary: meta.summary,
          imageUrl,
          articleUrl: url,
          publishedAt: '',
        });
      } catch (e) {
        console.error('[bnr] Failed to fetch article:', path, e);
      }
    }

    return articles;
  } finally {
    await browser?.close();
  }
}
