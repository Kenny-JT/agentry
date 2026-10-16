/**
 * Google access for the mail trigger (and the token the demo's Gmail / Calendar tools share):
 * a Desktop OAuth client, a loopback consent flow, refresh-token renewal, and the few Gmail
 * REST calls the watcher needs. No SDK — plain fetch.
 */
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { MailSummary } from '@agentry/core';

export interface GoogleFiles {
  /** Desktop-app OAuth client JSON as downloaded from the Cloud console ({ installed: {...} }). */
  client: string;
  /** Where the refresh token lives (written by `agentry-watch auth google`). */
  token: string;
}

export const defaultGoogleFiles = (): GoogleFiles => ({
  client: process.env.AGENTRY_GOOGLE_CLIENT ?? path.join(os.homedir(), '.agentry', 'google-client.json'),
  token: process.env.AGENTRY_GOOGLE_TOKEN ?? path.join(os.homedir(), '.agentry', 'google-token.json'),
});

export const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.events',
];

interface ClientInfo {
  client_id: string;
  client_secret: string;
}

interface StoredToken {
  access_token?: string;
  refresh_token: string;
  /** ms since epoch */
  expiry_date?: number;
  scope?: string;
}

function readClient(file: string): ClientInfo {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { installed?: ClientInfo; web?: ClientInfo };
  const info = raw.installed ?? raw.web;
  if (!info?.client_id || !info.client_secret) throw new Error(`${file} is not an OAuth client JSON (no installed.client_id)`);
  return info;
}

function writePrivate(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

async function tokenRequest(params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Google token endpoint: ${String(body.error ?? res.status)} ${String(body.error_description ?? '')}`.trim());
  return body;
}

/** A function that always yields a valid access token, renewing (and persisting) it as needed. */
export function googleAccess(files: GoogleFiles = defaultGoogleFiles()): () => Promise<string> {
  let cached: StoredToken | null = null;
  return async () => {
    cached ??= JSON.parse(fs.readFileSync(files.token, 'utf8')) as StoredToken;
    if (cached.access_token && (cached.expiry_date ?? 0) - Date.now() > 60_000) return cached.access_token;
    const client = readClient(files.client);
    const body = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: cached.refresh_token,
      client_id: client.client_id,
      client_secret: client.client_secret,
    });
    cached = {
      ...cached,
      access_token: String(body.access_token),
      expiry_date: Date.now() + Number(body.expires_in ?? 3600) * 1000,
    };
    writePrivate(files.token, cached);
    return cached.access_token!;
  };
}

/**
 * Loopback authorization-code flow (Google dropped device-code for these scopes): listen on
 * 127.0.0.1, send the browser to the consent page, trade the returned code for a refresh token.
 * `open(url)` decides which browser shows the consent page.
 */
export async function authorizeGoogle(files: GoogleFiles, scopes: string[], open: (url: string) => void, log: (m: string) => void): Promise<void> {
  const client = readClient(files.client);
  const state = randomBytes(16).toString('hex');
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const redirect = `http://127.0.0.1:${port}`;

  const code = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no consent within 5 minutes')), 5 * 60_000);
    server.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', redirect);
      const got = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (!got && !error) {
        res.writeHead(404).end();
        return;
      }
      const ok = Boolean(got) && url.searchParams.get('state') === state;
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><title>Agentry</title><body style="font:16px system-ui;padding:40px">${ok ? 'Agentry is connected to Google. You can close this tab.' : `Authorization failed: ${error ?? 'state mismatch'}`}</body>`);
      clearTimeout(timer);
      if (ok && got) resolve(got);
      else reject(new Error(`authorization failed: ${error ?? 'state mismatch'}`));
    });
    const consent = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    consent.search = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: redirect,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    }).toString();
    log(`consent page: ${consent.toString()}`);
    open(consent.toString());
  }).finally(() => server.close());

  const body = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirect,
    client_id: client.client_id,
    client_secret: client.client_secret,
  });
  if (typeof body.refresh_token !== 'string') throw new Error('Google returned no refresh_token (revoke the app grant and retry)');
  writePrivate(files.token, {
    access_token: String(body.access_token),
    refresh_token: body.refresh_token,
    expiry_date: Date.now() + Number(body.expires_in ?? 3600) * 1000,
    scope: String(body.scope ?? scopes.join(' ')),
  } satisfies StoredToken);
  // A Testing-mode consent screen issues refresh tokens that die after 7 days; Google says so
  // only through this field, so surface it instead of failing with invalid_grant a week later.
  if (body.refresh_token_expires_in) log(`note: this refresh token expires in ${Math.round(Number(body.refresh_token_expires_in) / 86400)} day(s) — the OAuth app is in Testing mode; re-run auth then`);
  log(`saved ${files.token}`);
}

// ── Gmail ──

export interface GmailApi {
  historyId(): Promise<string>;
  /** Message ids added since `startHistoryId`, or 'expired' when Google no longer has that point. */
  added(startHistoryId: string): Promise<{ historyId: string; ids: string[] } | 'expired'>;
  message(id: string): Promise<MailSummary & { labels: string[] }>;
  /** Ids of recent messages matching a Gmail search. */
  search(query: string): Promise<Set<string>>;
}

const MAX_BODY = 4000;

const decodeBase64Url = (data: string): string => Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: Array<{ name: string; value: string }>;
}

function findBody(part: GmailPart | undefined, mime: string): string | null {
  if (!part) return null;
  if (part.mimeType === mime && part.body?.data) return decodeBase64Url(part.body.data);
  for (const child of part.parts ?? []) {
    const found = findBody(child, mime);
    if (found) return found;
  }
  return null;
}

export function gmailApi(access: () => Promise<string>, base = 'https://gmail.googleapis.com/gmail/v1/users/me'): GmailApi {
  const get = async (pathAndQuery: string): Promise<{ status: number; body: Record<string, unknown> }> => {
    const res = await fetch(`${base}${pathAndQuery}`, { headers: { Authorization: `Bearer ${await access()}` } });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok && res.status !== 404) throw new Error(`Gmail ${pathAndQuery.split('?')[0]}: ${res.status} ${JSON.stringify(body.error ?? body).slice(0, 200)}`);
    return { status: res.status, body };
  };
  return {
    async historyId() {
      return String((await get('/profile')).body.historyId);
    },
    async added(start) {
      const ids: string[] = [];
      let page: string | undefined;
      let latest = start;
      do {
        const query = new URLSearchParams({ startHistoryId: start, historyTypes: 'messageAdded', ...(page ? { pageToken: page } : {}) });
        const { status, body } = await get(`/history?${query.toString()}`);
        if (status === 404) return 'expired';
        for (const entry of (body.history as Array<{ messagesAdded?: Array<{ message: { id: string } }> }> | undefined) ?? []) {
          for (const added of entry.messagesAdded ?? []) if (!ids.includes(added.message.id)) ids.push(added.message.id);
        }
        latest = String(body.historyId ?? latest);
        page = typeof body.nextPageToken === 'string' ? body.nextPageToken : undefined;
      } while (page);
      return { historyId: latest, ids };
    },
    async message(id) {
      const { body } = await get(`/messages/${id}?format=full`);
      const payload = body.payload as GmailPart | undefined;
      const header = (name: string) => payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? '';
      const plain = findBody(payload, 'text/plain');
      const html = plain ? null : findBody(payload, 'text/html');
      const text = (plain ?? (html ? html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n').replace(/<[^>]+>/g, ' ') : String(body.snippet ?? '')))
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return {
        id,
        threadId: String(body.threadId ?? ''),
        from: header('from'),
        to: header('to'),
        subject: header('subject'),
        date: header('date'),
        body: text.length > MAX_BODY ? `${text.slice(0, MAX_BODY)}…` : text,
        labels: (body.labelIds as string[] | undefined) ?? [],
      };
    },
    async search(query) {
      const { body } = await get(`/messages?${new URLSearchParams({ q: query, maxResults: '100' }).toString()}`);
      return new Set(((body.messages as Array<{ id: string }> | undefined) ?? []).map((m) => m.id));
    },
  };
}
