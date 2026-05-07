/**
 * Headless OAuth login for Keycloak-protected apps.
 *
 * Handles both:
 *  - Direct-redirect apps (app → Keycloak → app)
 *  - Apps with an intermediate login page (app → /login → OAuth link → Keycloak → app)
 *    e.g. Status shows its own login page with a "Sign in with ..." button first.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

type SessionState = { cookie: string; expiresAt: number };
const sessions = new Map<string, SessionState>();
const SESSION_TTL_MS = 25 * 60_000; // 25 min (re-auth before Keycloak 30-min session)

export function getSessionCookie(appUrl: string): Promise<string> {
  const existing = sessions.get(appUrl);
  if (existing && existing.expiresAt > Date.now()) return Promise.resolve(existing.cookie);
  return doHeadlessLogin(appUrl).then((cookie) => {
    sessions.set(appUrl, { cookie, expiresAt: Date.now() + SESSION_TTL_MS });
    return cookie;
  });
}

export function invalidateSession(appUrl: string): void {
  sessions.delete(appUrl);
}

// ─── Cookie jar helpers ──────────────────────────────────────────────────────

function parseCookies(res: Response, jar: Map<string, string>): void {
  const raw: string[] =
    (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const c of raw) {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieStr(jar: Map<string, string>): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href).toString();
  } catch {
    return new URL(href, base).toString();
  }
}

// ─── Core login flow ─────────────────────────────────────────────────────────

async function doHeadlessLogin(appUrl: string): Promise<string> {
  const user = process.env.MCSSE_USER;
  const pass = process.env.MCSSE_PASSWORD;
  if (!user || !pass) throw new Error('MCSSE_USER / MCSSE_PASSWORD not set');

  const jar = new Map<string, string>();
  console.log(`[session] Starting headless login for ${appUrl}`);

  // Step 1: GET the app — may redirect to Keycloak directly, or to an
  //         intermediate login page (e.g. Status shows its own login page first).
  const r1 = await fetch(appUrl, {
    redirect: 'manual',
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  parseCookies(r1, jar);

  let keycloakLoginUrl: string;

  const loc1 = r1.headers.get('location');

  if (loc1 && isKeycloakUrl(loc1)) {
    // Direct redirect to Keycloak
    keycloakLoginUrl = resolveUrl(loc1, appUrl);
  } else {
    // Intermediate step: follow the redirect to an app login page, then find OAuth link
    const intermediateUrl = loc1 ? resolveUrl(loc1, appUrl) : appUrl;
    const r2 = await fetch(intermediateUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html', Cookie: cookieStr(jar) },
    });
    parseCookies(r2, jar);
    const loginHtml = await r2.text();

    // Look for an OAuth/Keycloak sign-in link
    // Status uses href="/Status/login/generic_oauth" or similar
    const oauthLink = extractOAuthLink(loginHtml, r2.url);
    if (!oauthLink) throw new Error(`[session] Could not find OAuth sign-in link at ${r2.url}`);

    // Follow that link — it should redirect to Keycloak
    const r3 = await fetch(oauthLink, {
      redirect: 'manual',
      headers: { 'User-Agent': UA, Accept: 'text/html', Cookie: cookieStr(jar) },
    });
    parseCookies(r3, jar);
    const loc3 = r3.headers.get('location');
    if (!loc3) throw new Error(`[session] OAuth link did not redirect. Status: ${r3.status}`);
    keycloakLoginUrl = resolveUrl(loc3, oauthLink);
  }

  // Step 2: GET Keycloak login page (follow any internal Keycloak redirects)
  const r4 = await fetch(keycloakLoginUrl, {
    redirect: 'follow',
    headers: { 'User-Agent': UA, Accept: 'text/html', Cookie: cookieStr(jar) },
  });
  parseCookies(r4, jar);
  const loginHtml = await r4.text();

  const formMatch = loginHtml.match(/action="([^"]+)"/);
  if (!formMatch) throw new Error('[session] Could not find Keycloak login form');
  const formAction = formMatch[1].replace(/&amp;/g, '&');

  // Step 3: POST credentials
  const r5 = await fetch(formAction, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieStr(jar),
      Referer: r4.url,
    },
    body: new URLSearchParams({ username: user, password: pass, credentialId: '' }).toString(),
  });
  parseCookies(r5, jar);

  let location = r5.headers.get('location');
  if (!location) {
    const body = await r5.text();
    throw new Error(`[session] Login POST returned ${r5.status} without redirect. Body: ${body.slice(0, 300)}`);
  }

  // Step 4: Follow redirects back to the app (Keycloak → app callback → app home)
  for (let i = 0; i < 8 && location; i++) {
    const url = resolveUrl(location, appUrl);
    const r = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': UA, Accept: 'text/html', Cookie: cookieStr(jar) },
    });
    parseCookies(r, jar);
    location = r.headers.get('location');
  }

  console.log(`[session] Login successful for ${appUrl} — ${jar.size} cookies stored`);
  return cookieStr(jar);
}

function isKeycloakUrl(url: string): boolean {
  return url.includes('/realms/') || url.includes('/protocol/openid-connect/');
}

function extractOAuthLink(html: string, baseUrl: string): string | null {
  // Match href attributes containing oauth, sso, keycloak, or generic_oauth
  const patterns = [
    /href="([^"]*generic_oauth[^"]*)"/i,
    /href="([^"]*\/login\/[^"]*oauth[^"]*)"/i,
    /href="([^"]*sso[^"]*)"/i,
    /href="([^"]*keycloak[^"]*)"/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return resolveUrl(m[1].replace(/&amp;/g, '&'), baseUrl);
  }
  return null;
}
