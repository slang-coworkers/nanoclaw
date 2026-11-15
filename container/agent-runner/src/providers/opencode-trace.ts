import { appendFileSync, mkdirSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

/**
 * Tracing for the OpenCode backend, the counterpart of claude-trace.
 *
 * Two files per session land in `<agent dir>/.opencode-trace/`, which is
 * `groups/<folder>/.opencode-trace/` on the host:
 *
 *   session-<id>.jsonl         every model request and reply, as the model saw them
 *   session-<id>.events.jsonl  every event of OpenCode's own event stream
 *
 * The first file comes from a recording proxy. OpenCode sends its model calls to
 * the `baseURL` in its provider options. We start a proxy on the loopback
 * address and put that address in the options, so each call passes through here
 * on its way to the real endpoint. The proxy forwards with the container's own
 * proxy settings, so the OneCLI gateway and its model rules apply as before.
 * The second file is a copy of the events the runner already reads.
 *
 * Tracing must never change what a turn does. Every failure here is logged and
 * dropped; a proxy that cannot start leaves the config as it was.
 */

const DEFAULT_MAX_BODY_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_EVENT_STRING = 16 * 1024;
// A header or query name carries a credential when it is a known auth header, or ends in a word like
// key, token or secret. `x-ratelimit-remaining-tokens` ends in a plural, so it stays readable.
const SECRET_HEADER =
  /^(authorization|proxy-authorization|cookie|set-cookie)$|api[-_]?key$|(token|secret|signature|credential|password)$/i;
const SECRET_PARAM = /(key|token|secret|signature|password|passwd|auth|credential|sig)$/i;
// We forward the request bytes as they came, so a request keeps its encoding headers.
// The response is decoded by fetch before we pass it on, so its encoding headers no longer hold.
const REQUEST_SKIP = new Set(['host', 'connection', 'content-length', 'transfer-encoding']);
const RESPONSE_SKIP = new Set(['connection', 'content-length', 'content-encoding', 'transfer-encoding']);

export interface OpenCodeTraceSettings {
  enabled: boolean;
  dir: string;
  sessionId: string;
  maxBodyBytes: number;
}

/** Read the trace settings from the environment. `NANOCLAW_OPENCODE_TRACE=off` (or 0, false) disables both files. */
export function resolveOpenCodeTraceSettings(
  env: NodeJS.ProcessEnv = process.env,
  agentDir = '/workspace/agent',
): OpenCodeTraceSettings {
  const flag = (env.NANOCLAW_OPENCODE_TRACE ?? '').trim().toLowerCase();
  const rawMax = Number(env.NANOCLAW_OPENCODE_TRACE_MAX_BODY_BYTES);
  return {
    enabled: !['off', '0', 'false', 'no'].includes(flag),
    dir: env.NANOCLAW_OPENCODE_TRACE_DIR || path.join(agentDir, '.opencode-trace'),
    // The session id names the file, so keep it to a safe set of characters.
    sessionId: (env.NANOCLAW_SESSION_ID || `pid-${process.pid}`).replace(/[^A-Za-z0-9._-]/g, '_'),
    maxBodyBytes: Number.isSafeInteger(rawMax) && rawMax > 0 ? rawMax : DEFAULT_MAX_BODY_BYTES,
  };
}

/** Headers as a plain object with every credential-bearing value replaced. */
export function redactHeaders(headers: Iterable<[string, string]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of headers) {
    out[name.toLowerCase()] = SECRET_HEADER.test(name)
      ? '[redacted]'
      : name.toLowerCase() === 'location'
        ? redactUrl(value)
        : value;
  }
  return out;
}

/** The path and query with the value of every credential-like query parameter replaced. */
export function redactUrl(raw: string): string {
  const q = raw.indexOf('?');
  if (q < 0) return raw;
  const params = new URLSearchParams(raw.slice(q + 1));
  let changed = false;
  for (const name of [...params.keys()]) {
    if (SECRET_PARAM.test(name)) {
      params.set(name, '[redacted]');
      changed = true;
    }
  }
  return changed ? `${raw.slice(0, q)}?${params.toString()}` : raw;
}

/** The body as JSON when it parses, else as text, cut at `max` bytes with a flag. */
function bodyRecord(bytes: Buffer, max: number): { body: unknown; truncated?: true } {
  const truncated = bytes.length > max;
  const text = (truncated ? bytes.subarray(0, max) : bytes).toString('utf8');
  if (!truncated) {
    try {
      return { body: JSON.parse(text) };
    } catch {
      /* not JSON (an event stream, for example): keep the text */
    }
  }
  return { body: text, ...(truncated ? { truncated: true as const } : {}) };
}

function appendLine(file: string, record: unknown): void {
  try {
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    appendFileSync(file, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  } catch (error) {
    console.error(`[opencode-trace] could not write ${file}: ${error instanceof Error ? error.message : error}`);
  }
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export interface TraceProxy {
  /** The address to give OpenCode in place of the upstream base URL. */
  baseURL: string;
  close(): void;
}

/**
 * Start a recording proxy for one upstream base URL. A request to
 * `<proxy>/<path>` is forwarded to `<upstream origin>/<path>`; the proxy base
 * URL carries the upstream path prefix, so OpenCode's own relative paths land
 * where they did before.
 */
export async function startTraceProxy(
  upstream: string,
  settings: OpenCodeTraceSettings,
  fetchImpl: typeof fetch = fetch,
): Promise<TraceProxy> {
  const target = new URL(upstream);
  const file = path.join(settings.dir, `session-${settings.sessionId}.jsonl`);
  let counter = 0;

  const server: Server = createServer((req, res) => {
    const id = ++counter;
    const startedAt = Date.now();
    void (async () => {
      const requestBytes = await readBody(req);
      const url = `${target.origin}${req.url ?? '/'}`;
      const forwardHeaders = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (REQUEST_SKIP.has(name) || value === undefined) continue;
        forwardHeaders.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      const record: Record<string, unknown> = {
        id,
        at: new Date(startedAt).toISOString(),
        method: req.method,
        // Only the path and query: the host is in the config, and a query may name the model.
        url: redactUrl(req.url ?? '/'),
        requestHeaders: redactHeaders(forwardHeaders.entries()),
        request: bodyRecord(requestBytes, settings.maxBodyBytes),
      };
      // A client that goes away (a cancelled turn) stops the upstream call too.
      const abort = new AbortController();
      res.on('close', () => {
        if (!res.writableFinished) abort.abort();
      });
      const kept: Buffer[] = [];
      let keptBytes = 0;
      try {
        const upstreamResponse = await fetchImpl(url, {
          method: req.method,
          headers: forwardHeaders,
          body:
            requestBytes.length > 0 && req.method !== 'GET' && req.method !== 'HEAD'
              ? new Uint8Array(requestBytes)
              : undefined,
          // OpenCode's own fetch would follow a redirect and keep the credential for the same origin; we do the same.
          redirect: 'follow',
          signal: abort.signal,
        });
        const responseHeaders: Record<string, string> = {};
        upstreamResponse.headers.forEach((value, name) => {
          if (!RESPONSE_SKIP.has(name)) responseHeaders[name] = value;
        });
        res.writeHead(upstreamResponse.status, responseHeaders);
        record.status = upstreamResponse.status;
        record.responseHeaders = redactHeaders(Object.entries(responseHeaders));
        const reader = upstreamResponse.body?.getReader();
        if (reader) {
          // Some runtimes leave a body read pending after an abort; cancelling the reader ends it.
          abort.signal.addEventListener('abort', () => void reader.cancel().catch(() => {}), { once: true });
          // Pass each chunk on at once so streamed replies stay streamed, and keep a copy up to the cap.
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            // Wait for the client to catch up, so a slow reader cannot make us buffer a whole reply.
            if (!res.write(value)) {
              await new Promise<void>((resolve) => {
                res.once('drain', resolve);
                res.once('close', resolve);
              });
            }
            if (keptBytes <= settings.maxBodyBytes) {
              kept.push(Buffer.from(value));
              keptBytes += value.byteLength;
            }
          }
        }
        res.end();
      } catch (error) {
        record.error = error instanceof Error ? error.message : String(error);
        if (!res.destroyed) {
          if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
          res.end('trace proxy: upstream request failed');
        }
      }
      record.response = bodyRecord(Buffer.concat(kept), settings.maxBodyBytes);
      record.durationMs = Date.now() - startedAt;
      appendLine(file, record);
    })().catch((error) => {
      console.error(`[opencode-trace] proxy request failed: ${error instanceof Error ? error.message : error}`);
      try {
        res.destroy();
      } catch {
        /* ignore */
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  // The proxy must not keep the runner alive on its own.
  server.unref();
  const { port } = server.address() as AddressInfo;
  return {
    baseURL: `http://127.0.0.1:${port}${target.pathname === '/' ? '' : target.pathname.replace(/\/$/, '')}`,
    close: () => server.close(),
  };
}

const proxies = new Map<string, Promise<TraceProxy>>();

/**
 * Return `config` with every provider `baseURL` pointed at a recording proxy.
 * A provider with no `baseURL` (the `native` endpoint) is left alone, because we
 * do not know its address. Nothing changes when tracing is off or a proxy fails
 * to start.
 */
export async function applyOpenCodeTrace(
  config: Record<string, unknown>,
  settings: OpenCodeTraceSettings = resolveOpenCodeTraceSettings(),
): Promise<Record<string, unknown>> {
  if (!settings.enabled) return config;
  const providers = config.provider as Record<string, { options?: Record<string, unknown> }> | undefined;
  if (!providers) return config;
  const next: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(providers)) {
    const upstream = entry?.options?.baseURL;
    if (typeof upstream !== 'string' || !/^https?:\/\//.test(upstream)) {
      next[name] = entry;
      continue;
    }
    try {
      const cacheKey = `${settings.dir}|${settings.sessionId}|${settings.maxBodyBytes}|${upstream}`;
      let proxy = proxies.get(cacheKey);
      if (!proxy) {
        proxy = startTraceProxy(upstream, settings);
        proxies.set(cacheKey, proxy);
        proxy.catch(() => proxies.delete(cacheKey));
      }
      next[name] = { ...entry, options: { ...entry.options, baseURL: (await proxy).baseURL } };
    } catch (error) {
      console.error(`[opencode-trace] no proxy for ${name}: ${error instanceof Error ? error.message : error}`);
      next[name] = entry;
    }
  }
  return { ...config, provider: next };
}

/** Stop every recording proxy. Used when the shared runtime is torn down in tests. */
export function stopOpenCodeTraceProxies(): void {
  for (const proxy of proxies.values()) void proxy.then((p) => p.close()).catch(() => {});
  proxies.clear();
}

function clip(value: unknown, max: number): unknown {
  if (typeof value === 'string')
    return value.length > max ? `${value.slice(0, max)}…[${value.length - max} more]` : value;
  if (Array.isArray(value)) return value.map((item) => clip(item, max));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clip(item, max)]));
  }
  return value;
}

/** Append one OpenCode event to the session's event file. Long strings are cut so one tool result cannot fill the disk. */
export function recordOpenCodeEvent(
  event: { type: string; properties: Record<string, unknown> },
  settings: OpenCodeTraceSettings = resolveOpenCodeTraceSettings(),
): void {
  if (!settings.enabled) return;
  appendLine(path.join(settings.dir, `session-${settings.sessionId}.events.jsonl`), {
    at: new Date().toISOString(),
    type: event.type,
    properties: clip(event.properties, DEFAULT_MAX_EVENT_STRING),
  });
}
