/**
 * OAuth resource-owner password grant against a Keycloak-style provider.
 *
 * Reads from env:
 *   AUTH_URL    — the authorization endpoint URL (may include ?client_id=xxx)
 *                 e.g. https://auth.example.com/realms/mss/protocol/openid-connect/auth?client_id=my-app
 *                 The token endpoint is derived by replacing /auth with /token.
 *   MCSSE_USER  — username
 *   MCSSE_PASSWORD — password
 */

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

/** Derive the token endpoint from the auth endpoint URL */
function toTokenUrl(authUrl: string): string {
  const u = new URL(authUrl);
  u.pathname = u.pathname.replace(/\/auth$/, '/token');
  u.search = '';
  return u.toString();
}

/** Extract client_id from the auth URL query string */
function extractClientId(authUrl: string): string {
  const u = new URL(authUrl);
  return u.searchParams.get('client_id') || 'narrowcast';
}

export async function initOAuth(): Promise<void> {
  const authUrl = process.env.AUTH_URL;
  const user = process.env.MCSSE_USER;
  const pass = process.env.MCSSE_PASSWORD;

  if (!authUrl || !user || !pass) {
    console.warn('[oauth] AUTH_URL / MCSSE_USER / MCSSE_PASSWORD not set — proxy auth disabled');
    return;
  }

  const tokenUrl = toTokenUrl(authUrl);
  const clientId = extractClientId(authUrl);
  console.log(`[oauth] Token endpoint: ${tokenUrl}, client_id: ${clientId}`);

  await loginWithPassword(tokenUrl, clientId, user, pass);
}

async function loginWithPassword(
  tokenUrl: string, clientId: string, user: string, pass: string
): Promise<void> {
  try {
    const clientSecret = process.env.OAUTH_CLIENT_SECRET;
    const body = new URLSearchParams({
      grant_type: 'password',
      username: user,
      password: pass,
      client_id: clientId,
      scope: 'openid profile',
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[oauth] Login failed ${res.status}: ${text.slice(0, 200)}`);
      scheduleRetry(tokenUrl, clientId, user, pass, 60);
      return;
    }

    const data = await res.json() as TokenResponse;
    storeTokens(data);
    console.log(`[oauth] Logged in — token expires in ${data.expires_in}s`);
    scheduleRefresh(tokenUrl, clientId, user, pass, data);
  } catch (err) {
    console.error('[oauth] Login error:', err);
    scheduleRetry(tokenUrl, clientId, user, pass, 30);
  }
}

async function doRefresh(
  tokenUrl: string, clientId: string, user: string, pass: string
): Promise<void> {
  if (!refreshToken) {
    await loginWithPassword(tokenUrl, clientId, user, pass);
    return;
  }

  try {
    const clientSecret = process.env.OAUTH_CLIENT_SECRET;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      console.warn('[oauth] Refresh failed, re-logging in...');
      await loginWithPassword(tokenUrl, clientId, user, pass);
      return;
    }

    const data = await res.json() as TokenResponse;
    storeTokens(data);
    console.log(`[oauth] Token refreshed — next refresh in ${Math.round(data.expires_in * 0.85)}s`);
    scheduleRefresh(tokenUrl, clientId, user, pass, data);
  } catch (err) {
    console.error('[oauth] Refresh error:', err);
    scheduleRetry(tokenUrl, clientId, user, pass, 30);
  }
}

function storeTokens(data: TokenResponse): void {
  accessToken = data.access_token;
  if (data.refresh_token) refreshToken = data.refresh_token;
}

function scheduleRefresh(
  tokenUrl: string, clientId: string, user: string, pass: string, data: TokenResponse
): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  const delayMs = Math.max(data.expires_in * 0.85 * 1000, 10_000);
  refreshTimer = setTimeout(() => doRefresh(tokenUrl, clientId, user, pass), delayMs);
}

function scheduleRetry(
  tokenUrl: string, clientId: string, user: string, pass: string, delaySec: number
): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => loginWithPassword(tokenUrl, clientId, user, pass), delaySec * 1000);
}
