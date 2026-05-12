import puppeteer from 'puppeteer';
import type { Browser, Page, Cookie } from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CACHE_DIR      = path.resolve(process.env.CACHE_DIR || './cache');
const SCREENSHOT_PATH = path.join(CACHE_DIR, 'msg.png');
const COOKIES_PATH   = path.join(CACHE_DIR, 'msg-session.json');

function cfg() {
  return {
    url:      process.env.MSG_URL      || '',
    username: process.env.MSG_USERNAME || '',
    password: process.env.MSG_PASSWORD || '',
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function loadCookies(): Cookie[] {
  try {
    if (fs.existsSync(COOKIES_PATH))
      return JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8')) as Cookie[];
  } catch { /* corrupt file — ignore */ }
  return [];
}

function saveCookies(cookies: Cookie[]): void {
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2), 'utf8');
}

async function isOnLoginPage(page: Page): Promise<boolean> {
  // Detect by the presence of the username/email input (not the password field,
  // which on this site is always in the DOM but initially hidden off-screen)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — runs in browser context via Puppeteer
  return page.evaluate(() => !!document.querySelector('#loginform, input[name="Username"]'));
}

async function login(page: Page, username: string, password: string): Promise<void> {
  console.log('[msg] Login page detected — authenticating...');

  // ── Step 1: fill email and click Login to reveal the password field ──────────
  await page.waitForSelector('input[name="Username"], input[type="email"]', { timeout: 15_000 });

  await page.click('input[name="Username"], input[type="email"]', { clickCount: 3 });
  await page.type('input[name="Username"], input[type="email"]', username, { delay: 30 });

  // Click the Login button (not Register) — this triggers JS that removes
  // the `moveOffScreen` class from the password field.
  await page.click('button[value="login"]');

  // ── Step 2: wait for password field to slide into view, then fill it ─────────
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — runs in browser context via Puppeteer, DOM globals are valid
  await page.waitForFunction(
    // @ts-ignore
    () => { const pw = document.querySelector('input[type="password"]'); return pw !== null && !pw.classList.contains('moveOffScreen'); },
    { timeout: 10_000 }
  );

  await page.click('input[type="password"]', { clickCount: 3 });
  await page.type('input[type="password"]', password, { delay: 30 });

  // Submit the form — click Login again; wait for redirect away from the login page
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 }),
    page.click('button[value="login"]'),
  ]);

  console.log('[msg] Login submitted, landed on:', page.url());
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function fetchMsg(): Promise<void> {
  const { url, username, password } = cfg();
  if (!url) throw new Error('[msg] MSG_URL is not configured');

  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
    );

    // Restore persisted session cookies
    const saved = loadCookies();
    if (saved.length) await page.setCookie(...saved);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });

    // Handle login redirect — might take one or two hops (e.g. SSO provider)
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!(await isOnLoginPage(page))) break;
      await login(page, username, password);
      // After login some providers redirect back to the original URL automatically;
      // others land on a dashboard — navigate to the target URL to be safe.
      if (page.url() !== url && !page.url().startsWith(url)) {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
      }
    }

    if (await isOnLoginPage(page)) {
      throw new Error('[msg] Still on login page after authentication — check credentials');
    }

    // Persist session cookies so the next run skips login
    saveCookies(await page.cookies());

    // Let the page settle (charts, lazy-loaded content)
    await new Promise(r => setTimeout(r, 2_500));

    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    await page.screenshot({ path: SCREENSHOT_PATH });
    console.log('[msg] Screenshot saved');
  } finally {
    await browser?.close();
  }
}

export function hasMsgScreenshot(): boolean {
  return fs.existsSync(SCREENSHOT_PATH);
}
