import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const IMAGES_DIR = path.resolve(process.env.CACHE_DIR || './cache', 'images');

function ensureDir(): void {
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

export async function cacheImage(remoteUrl: string): Promise<string | undefined> {
  try {
    ensureDir();
    const ext = remoteUrl.split('?')[0].match(/\.(jpe?g|png|webp|gif)/i)?.[1]?.toLowerCase() ?? 'jpg';
    const hash = crypto.createHash('md5').update(remoteUrl).digest('hex');
    const filename = `${hash}.${ext}`;
    const localPath = path.join(IMAGES_DIR, filename);

    if (!fs.existsSync(localPath)) {
      const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return undefined;
      const buf = await res.arrayBuffer();
      fs.writeFileSync(localPath, Buffer.from(buf));
    }

    return `/static/images/${filename}`;
  } catch {
    return undefined;
  }
}

export function pruneImages(activeLocalUrls: Set<string>): void {
  if (!fs.existsSync(IMAGES_DIR)) return;
  for (const file of fs.readdirSync(IMAGES_DIR)) {
    if (!activeLocalUrls.has(`/static/images/${file}`)) {
      fs.unlinkSync(path.join(IMAGES_DIR, file));
      console.log(`[images] Pruned stale image: ${file}`);
    }
  }
}
