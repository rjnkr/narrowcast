import { NewsArticle } from '../types';
import { XMLParser } from 'fast-xml-parser';
import crypto from 'crypto';
import { cacheImage } from '../cache/images';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function extractText(val: unknown): string {
  if (typeof val === 'string') return val.trim();
  if (val && typeof val === 'object' && '#text' in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>)['#text']).trim();
  }
  return '';
}

function extractImage(item: Record<string, unknown>): string | undefined {
  // Try media:content
  const media = item['media:content'] as Record<string, unknown> | undefined;
  if (media?.['@_url']) return String(media['@_url']);

  // Try enclosure
  const enc = item['enclosure'] as Record<string, unknown> | undefined;
  if (enc?.['@_url'] && String(enc['@_url']).match(/\.(jpg|jpeg|png|webp)/i)) {
    return String(enc['@_url']);
  }

  // Try description img tag
  const desc = extractText(item['description'] || item['content:encoded'] || '');
  const match = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match) return match[1];

  return undefined;
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—', '&lsquo;': '‘',
  '&rsquo;': '’', '&ldquo;': '“', '&rdquo;': '”',
  '&hellip;': '…', '&bull;': '•', '&copy;': '©', '&reg;': '®',
};

function decodeEntities(text: string): string {
  // Named entities
  let out = text.replace(/&[a-z]+;/gi, (e) => HTML_ENTITIES[e.toLowerCase()] ?? e);
  // Decimal numeric entities e.g. &#8216;
  out = out.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));
  // Hex numeric entities e.g. &#x2019;
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  return out;
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
}

export async function parseRss(
  url: string,
  source: NewsArticle['source'],
  limit = 20
): Promise<NewsArticle[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TidalisNarrowcast/1.0' },
  });
  if (!res.ok) throw new Error(`RSS fetch error ${res.status} for ${url}`);
  const xml = await res.text();
  const parsed = parser.parse(xml);
  const items: Record<string, unknown>[] = parsed?.rss?.channel?.item || [];

  const articles = items.slice(0, limit).map((item) => {
    const title = stripHtml(extractText(item['title'] || ''));
    const rawDesc = extractText(item['description'] || item['content:encoded'] || '');
    const summary = stripHtml(rawDesc).slice(0, 400);
    const articleUrl = extractText(item['link'] || item['guid'] || '');
    const publishedAt = extractText(item['pubDate'] || '');
    const imageUrl = extractImage(item);
    const id = crypto.createHash('md5').update(articleUrl || title).digest('hex');

    return { id, source, title, summary, imageUrl, articleUrl, publishedAt };
  });

  // Download images in parallel, replace remote URLs with local cached paths
  await Promise.all(
    articles.map(async (article) => {
      if (article.imageUrl && article.imageUrl.startsWith('http')) {
        const local = await cacheImage(article.imageUrl);
        if (local) article.imageUrl = local;
      }
    })
  );

  return articles;
}
