import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  applyOpenCodeTrace,
  recordOpenCodeEvent,
  redactHeaders,
  redactUrl,
  resolveOpenCodeTraceSettings,
  startTraceProxy,
  stopOpenCodeTraceProxies,
  type OpenCodeTraceSettings,
} from './opencode-trace.js';

let dir: string;
let upstream: Server;
let upstreamUrl: string;
let seen: { url?: string; headers: Record<string, unknown>; body: string }[];
let settings: OpenCodeTraceSettings;
let upstreamClosed: boolean;

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'oc-trace-'));
  seen = [];
  upstreamClosed = false;
  settings = { enabled: true, dir, sessionId: 's1', maxBodyBytes: 1024 };
  upstream = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      seen.push({ url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() });
      if (req.url?.endsWith('/redirect')) {
        res.writeHead(307, { location: `${upstreamUrl}/target` });
        res.end();
        return;
      }
      if (req.url?.endsWith('/hang')) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write('data: first\n\n');
        res.on('close', () => {
          upstreamClosed = true;
        });
        return;
      }
      if (req.url?.endsWith('/stream')) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write('data: {"a":1}\n\n');
        setTimeout(() => res.end('data: [DONE]\n\n'), 20);
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json', 'set-cookie': 'k=v' });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', () => r()));
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}/llm/v1`;
});
afterEach(() => {
  stopOpenCodeTraceProxies();
  upstream.close();
  rmSync(dir, { recursive: true, force: true });
});

const lines = (file: string) =>
  readFileSync(path.join(dir, file), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));

describe('settings', () => {
  it('is on unless switched off, and keeps the session id file-safe', () => {
    expect(resolveOpenCodeTraceSettings({}, '/a').enabled).toBe(true);
    expect(resolveOpenCodeTraceSettings({ NANOCLAW_OPENCODE_TRACE: 'off' }, '/a').enabled).toBe(false);
    expect(resolveOpenCodeTraceSettings({ NANOCLAW_OPENCODE_TRACE: '0' }, '/a').enabled).toBe(false);
    const s = resolveOpenCodeTraceSettings({ NANOCLAW_SESSION_ID: '../x/y' }, '/a');
    expect(s.sessionId).toBe('.._x_y');
    expect(s.dir).toBe('/a/.opencode-trace');
  });
  it('removes credential headers', () => {
    expect(
      redactHeaders([
        ['Authorization', 'Bearer abc'],
        ['x-api-key', 'k'],
        ['content-type', 'application/json'],
      ]),
    ).toEqual({ authorization: '[redacted]', 'x-api-key': '[redacted]', 'content-type': 'application/json' });
  });
});

describe('credential redaction', () => {
  it('covers vendor auth headers but keeps rate-limit counters', () => {
    const out = redactHeaders([
      ['x-goog-api-key', 'a'],
      ['x-amz-security-token', 'b'],
      ['x-ratelimit-remaining-tokens', '99'],
      ['location', 'https://h/p?key=SECRET&model=m'],
    ]);
    expect(out['x-goog-api-key']).toBe('[redacted]');
    expect(out['x-amz-security-token']).toBe('[redacted]');
    expect(out['x-ratelimit-remaining-tokens']).toBe('99');
    expect(out.location).not.toContain('SECRET');
    expect(out.location).toContain('model=m');
  });
  it('redacts credential query values and leaves other URLs byte for byte', () => {
    expect(redactUrl('/v1/x?key=SECRET&model=a%2Fb')).toBe('/v1/x?key=%5Bredacted%5D&model=a%2Fb');
    expect(redactUrl('/v1/x?model=a/b')).toBe('/v1/x?model=a/b');
    expect(redactUrl('/v1/x')).toBe('/v1/x');
  });
});

describe('recording proxy', () => {
  it('forwards a request unchanged, records both sides and redacts credentials', async () => {
    const proxy = await startTraceProxy(upstreamUrl, settings);
    expect(proxy.baseURL.endsWith('/llm/v1')).toBe(true);
    const res = await fetch(`${proxy.baseURL}/chat/completions?x=1`, {
      method: 'POST',
      headers: { authorization: 'Bearer SECRET', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    });
    expect(await res.json()).toEqual({ ok: true });
    // The upstream saw the real path and the real credential.
    expect(seen[0].url).toBe('/llm/v1/chat/completions?x=1');
    expect(seen[0].headers.authorization).toBe('Bearer SECRET');
    const [record] = lines('session-s1.jsonl');
    expect(record.method).toBe('POST');
    expect(record.url).toBe('/llm/v1/chat/completions?x=1');
    expect(record.status).toBe(200);
    expect(record.request.body.messages[0].content).toBe('hi');
    expect(record.response.body).toEqual({ ok: true });
    expect(record.requestHeaders.authorization).toBe('[redacted]');
    expect(record.responseHeaders['set-cookie']).toBe('[redacted]');
    expect(JSON.stringify(record)).not.toContain('SECRET');
  });

  it('streams a reply through and records the whole text', async () => {
    const proxy = await startTraceProxy(upstreamUrl, settings);
    const res = await fetch(`${proxy.baseURL}/stream`, { method: 'POST', body: '{}' });
    expect(await res.text()).toBe('data: {"a":1}\n\ndata: [DONE]\n\n');
    const [record] = lines('session-s1.jsonl');
    expect(record.response.body).toBe('data: {"a":1}\n\ndata: [DONE]\n\n');
  });

  it('cuts a large body at the cap and says so', async () => {
    const proxy = await startTraceProxy(upstreamUrl, settings);
    await fetch(`${proxy.baseURL}/x`, { method: 'POST', body: 'a'.repeat(5000) });
    const [record] = lines('session-s1.jsonl');
    expect(record.request.truncated).toBe(true);
    expect(record.request.body.length).toBe(1024);
    expect(seen[0].body.length).toBe(5000);
  });

  it('keeps the encoding headers of a request it forwards as raw bytes', async () => {
    const proxy = await startTraceProxy(upstreamUrl, settings);
    await fetch(`${proxy.baseURL}/x`, {
      method: 'POST',
      headers: { 'content-encoding': 'gzip', 'content-type': 'application/json' },
      body: new Uint8Array([0x1f, 0x8b, 8, 0]),
    });
    expect(seen[0].headers['content-encoding']).toBe('gzip');
    const [record] = lines('session-s1.jsonl');
    expect(record.url).toBe('/llm/v1/x');
  });

  it('records a query credential as redacted while the upstream still gets it', async () => {
    const proxy = await startTraceProxy(upstreamUrl, settings);
    await fetch(`${proxy.baseURL}/x?key=SECRET`, { method: 'POST', body: '{}' });
    expect(seen[0].url).toBe('/llm/v1/x?key=SECRET');
    expect(JSON.stringify(lines('session-s1.jsonl'))).not.toContain('SECRET');
  });

  it('follows a redirect for the client', async () => {
    const proxy = await startTraceProxy(upstreamUrl, settings);
    const res = await fetch(`${proxy.baseURL}/redirect`, { method: 'POST', body: '{}' });
    expect(await res.json()).toEqual({ ok: true });
    expect(seen.map((r) => r.url)).toEqual(['/llm/v1/redirect', '/llm/v1/target']);
    // The proxy followed it, so the client saw one call and the record has the final status.
    const rows = lines('session-s1.jsonl');
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(200);
  });

  it('stops the upstream call when the client goes away', async () => {
    const proxy = await startTraceProxy(upstreamUrl, settings);
    const target = new URL(`${proxy.baseURL}/hang`);
    // A raw socket client: closing it is the plain way a client leaves mid-reply.
    await new Promise<void>((resolve) => {
      const req = httpRequest(
        { host: target.hostname, port: target.port, path: target.pathname, method: 'POST' },
        (res) => {
          res.once('data', () => {
            req.destroy();
            resolve();
          });
        },
      );
      req.on('error', () => {});
      req.end('{}');
    });
    await new Promise((r) => setTimeout(r, 300));
    expect(upstreamClosed).toBe(true);
  });

  it('answers 502 and records the error when the upstream is down', async () => {
    const proxy = await startTraceProxy('http://127.0.0.1:1/v1', settings);
    const res = await fetch(`${proxy.baseURL}/x`, { method: 'POST', body: '{}' });
    expect(res.status).toBe(502);
    const [record] = lines('session-s1.jsonl');
    expect(typeof record.error).toBe('string');
  });
});

describe('applyOpenCodeTrace', () => {
  const config = () => ({
    model: 'openai/m',
    provider: { openai: { npm: 'x', options: { apiKey: 'k', baseURL: upstreamUrl } } },
  });

  it('points the provider at the proxy and leaves everything else alone', async () => {
    const out = (await applyOpenCodeTrace(config(), settings)) as ReturnType<typeof config>;
    const base = out.provider.openai.options.baseURL;
    expect(base.startsWith('http://127.0.0.1:')).toBe(true);
    expect(base.endsWith('/llm/v1')).toBe(true);
    expect(out.provider.openai.options.apiKey).toBe('k');
    expect(out.provider.openai.npm).toBe('x');
    expect(out.model).toBe('openai/m');
  });

  it('reuses one proxy for the same upstream', async () => {
    const a = (await applyOpenCodeTrace(config(), settings)) as ReturnType<typeof config>;
    const b = (await applyOpenCodeTrace(config(), settings)) as ReturnType<typeof config>;
    expect(a.provider.openai.options.baseURL).toBe(b.provider.openai.options.baseURL);
  });

  it('does nothing when off, or for a provider with no base URL', async () => {
    const off = await applyOpenCodeTrace(config(), { ...settings, enabled: false });
    expect(off).toEqual(config());
    const native = { provider: { anthropic: { options: { apiKey: 'k' } } } };
    expect(await applyOpenCodeTrace(native, settings)).toEqual(native);
  });
});

describe('event log', () => {
  it('appends events and cuts long strings', () => {
    recordOpenCodeEvent({ type: 'message.part.updated', properties: { part: { text: 'z'.repeat(40000) } } }, settings);
    const [row] = lines('session-s1.events.jsonl');
    expect(row.type).toBe('message.part.updated');
    expect(row.properties.part.text.length).toBeLessThan(17000);
    expect(row.properties.part.text).toContain('more]');
  });
  it('writes nothing when off', () => {
    recordOpenCodeEvent({ type: 't', properties: {} }, { ...settings, enabled: false });
    expect(existsSync(path.join(dir, 'session-s1.events.jsonl'))).toBe(false);
  });
});
