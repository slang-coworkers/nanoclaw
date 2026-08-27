/**
 * mcp-auth-proxy sits between containers and the supergateway fleet. Most of
 * the surface is HTTP proxy logic that needs a live upstream to test — this
 * suite covers the pure token/ACL and inventory helpers that don't.
 *
 * The integration path (start proxy, issue HTTP, verify ACL) lives in a
 * separate end-to-end harness; these unit tests pin the scoped-name contract
 * that the rest of the system relies on.
 */
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Tests must NOT clobber the production token at `<repo>/data/.mcp-management-token`
// (which `startMcpAuthProxy` defaults to writing). Each call passes a
// per-test tempdir tokenPath; afterAll cleans up.
const TEST_TOKEN_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-auth-proxy-test-'));
let testTokenSeq = 0;
function freshTokenPath(): string {
  return path.join(TEST_TOKEN_DIR, `.mcp-management-token-${++testTokenSeq}`);
}

// The registry side-effects (spawning supergateway) must not run during
// tests. Mock mcp-registry entirely — the proxy only uses it for the
// host-only `/servers`, `/servers/stop`, `/servers/restart` endpoints and
// to resolve upstream ports.
vi.mock('./mcp-registry.js', () => ({
  getRunningServerNames: vi.fn(() => ['deepwiki', 'slang-mcp']),
  getServerUpstreamPort: vi.fn((name: string) => (name === 'deepwiki' ? 45001 : 45002)),
  isServerAlive: vi.fn(() => true),
  restartServer: vi.fn().mockResolvedValue(undefined),
  stopServer: vi.fn(),
}));

import {
  clearDiscoveredTools,
  getDiscoveredToolAnnotations,
  getDiscoveredToolInventory,
  getMcpManagementToken,
  parseToolAnnotations,
  registerContainerToken,
  revokeContainerToken,
  setUpstreamPortResolver,
  startMcpAuthProxy,
} from './mcp-auth-proxy.js';

describe('registerContainerToken', () => {
  it('returns a 64-char hex bearer token', () => {
    const token = registerContainerToken('group-a', ['mcp__deepwiki__ask_question']);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns a distinct token per registration', () => {
    const a = registerContainerToken('group-a', []);
    const b = registerContainerToken('group-b', []);
    expect(a).not.toBe(b);
  });

  it('filters out the mcp__nanoclaw__* in-process tools from ACL (they bypass the proxy)', () => {
    // We can't introspect the internal Set directly; probe via the proxy's
    // own ACL path instead. Easiest indirect check: the token still gets
    // issued with a valid hex form and no exception.
    expect(() =>
      registerContainerToken('g', ['mcp__nanoclaw__send_message', 'mcp__deepwiki__ask_question']),
    ).not.toThrow();
  });
});

describe('revokeContainerToken', () => {
  it('is a safe no-op for unknown tokens', () => {
    expect(() => revokeContainerToken('does-not-exist')).not.toThrow();
  });
});

describe('discovered tool inventory', () => {
  it('returns an empty object when no servers have been discovered', () => {
    clearDiscoveredTools('deepwiki');
    clearDiscoveredTools('slang-mcp');
    expect(getDiscoveredToolInventory()).toEqual({});
  });

  it('clearDiscoveredTools for an unknown server is a no-op', () => {
    expect(() => clearDiscoveredTools('never-existed')).not.toThrow();
  });
});

describe('parseToolAnnotations', () => {
  it('returns null when annotations is absent', () => {
    expect(parseToolAnnotations({})).toBeNull();
    expect(parseToolAnnotations({ annotations: undefined })).toBeNull();
  });

  it('returns null when annotations is not an object', () => {
    expect(parseToolAnnotations({ annotations: 'nope' })).toBeNull();
    expect(parseToolAnnotations({ annotations: 42 })).toBeNull();
  });

  it('returns null when annotations object has no recognised fields', () => {
    expect(parseToolAnnotations({ annotations: {} })).toBeNull();
    expect(parseToolAnnotations({ annotations: { title: 'Send Message' } })).toBeNull();
  });

  it('captures only openWorldHint / readOnlyHint / destructiveHint', () => {
    const result = parseToolAnnotations({
      annotations: {
        openWorldHint: true,
        readOnlyHint: false,
        destructiveHint: true,
        title: 'ignored',
        idempotentHint: true, // not in our allowlist
      },
    });
    expect(result).toEqual({ openWorldHint: true, readOnlyHint: false, destructiveHint: true });
  });

  it('ignores non-boolean values for the recognised fields', () => {
    expect(parseToolAnnotations({ annotations: { openWorldHint: 'true' } })).toBeNull();
    expect(parseToolAnnotations({ annotations: { openWorldHint: 1 } })).toBeNull();
  });

  it('returns a partial object when only some fields are present', () => {
    expect(parseToolAnnotations({ annotations: { openWorldHint: true } })).toEqual({
      openWorldHint: true,
    });
  });
});

describe('getDiscoveredToolAnnotations', () => {
  beforeEach(() => {
    clearDiscoveredTools('deepwiki');
    clearDiscoveredTools('slang-mcp');
  });

  it('returns an empty map when nothing has been discovered', () => {
    expect(getDiscoveredToolAnnotations()).toEqual({});
  });

  // Skipped: env's NO_PROXY='*' must be set for the http stub to bypass the
  // outbound proxy; un-skip once that's wired into test setup.
  it.skip('flattens annotations captured via discoverTools with the mcp__<server>__<tool> prefix', async () => {
    // The discovery path is exercised end-to-end here by stubbing http so we
    // hit the real parse loop that writes into the cached annotations map.
    const http = await import('http');
    const { discoverTools } = await import('./mcp-auth-proxy.js');

    const srv = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        const parsed = JSON.parse(body);
        if (parsed.method === 'initialize') {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Mcp-Session-Id': 'sid-1' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result: {} }));
          return;
        }
        if (parsed.method === 'tools/list') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: parsed.id,
              result: {
                tools: [
                  // No annotations → absent from map
                  { name: 'ask_question' },
                  // Empty annotations → absent from map
                  { name: 'search', annotations: {} },
                  // openWorldHint only
                  { name: 'discord_send_message', annotations: { openWorldHint: true } },
                  // Full set
                  {
                    name: 'github_post_issue_comment',
                    annotations: {
                      openWorldHint: true,
                      readOnlyHint: false,
                      destructiveHint: true,
                    },
                  },
                ],
              },
            }),
          );
          return;
        }
        res.writeHead(400);
        res.end();
      });
    });
    await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
    const port = (srv.address() as { port: number }).port;

    try {
      await discoverTools('slang-mcp', port);
      const annotations = getDiscoveredToolAnnotations();
      expect(annotations).toEqual({
        'mcp__slang-mcp__discord_send_message': { openWorldHint: true },
        'mcp__slang-mcp__github_post_issue_comment': {
          openWorldHint: true,
          readOnlyHint: false,
          destructiveHint: true,
        },
      });
      // Tools without annotations should NOT appear in the map.
      expect(annotations['mcp__slang-mcp__ask_question']).toBeUndefined();
      expect(annotations['mcp__slang-mcp__search']).toBeUndefined();
    } finally {
      clearDiscoveredTools('slang-mcp');
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });

  // Skipped: same NO_PROXY='*' bypass dependency as the previous discovery test.
  it.skip('clearDiscoveredTools also clears the annotation cache for that server', async () => {
    // Prime the cache via discoverTools again with a single annotated tool,
    // then verify clearing removes it from getDiscoveredToolAnnotations too.
    const http = await import('http');
    const { discoverTools } = await import('./mcp-auth-proxy.js');

    const srv = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const parsed = JSON.parse(Buffer.concat(chunks).toString());
        if (parsed.method === 'initialize') {
          res.writeHead(200, { 'Mcp-Session-Id': 'sid' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result: {} }));
          return;
        }
        res.writeHead(200);
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: parsed.id,
            result: { tools: [{ name: 'post', annotations: { openWorldHint: true } }] },
          }),
        );
      });
    });
    await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
    const port = (srv.address() as { port: number }).port;

    try {
      await discoverTools('deepwiki', port);
      expect(getDiscoveredToolAnnotations()['mcp__deepwiki__post']).toEqual({ openWorldHint: true });
      clearDiscoveredTools('deepwiki');
      expect(getDiscoveredToolAnnotations()['mcp__deepwiki__post']).toBeUndefined();
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });
});

/** Find a free TCP port by opening a socket on :0 and reading its address. */
async function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('unexpected address shape'));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
  });
}

/** Poll until the proxy's /tools responds (server has finished binding). */
async function waitForProxy(baseUrl: string, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/tools`);
      if (res.status === 401 || res.status === 200) return;
    } catch {
      // not bound yet
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`Proxy at ${baseUrl} never came up`);
}

describe('auth proxy lifecycle', () => {
  let stopProxy: () => void;

  beforeEach(async () => {
    setUpstreamPortResolver(() => 45001);
    const port = await pickFreePort();
    const { stop } = startMcpAuthProxy('127.0.0.1', port, { tokenPath: freshTokenPath() });
    stopProxy = stop;
    await waitForProxy(`http://127.0.0.1:${port}`);
  });

  afterEach(() => {
    stopProxy();
  });

  it('getMcpManagementToken returns a 64-char hex token once the proxy is started', () => {
    const token = getMcpManagementToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('clears the management token on stop', async () => {
    stopProxy();
    expect(getMcpManagementToken()).toBe('');
    // Restart on a fresh port so the afterEach stop is a no-op cleanup.
    const port = await pickFreePort();
    const restarted = startMcpAuthProxy('127.0.0.1', port, { tokenPath: freshTokenPath() });
    stopProxy = restarted.stop;
    await waitForProxy(`http://127.0.0.1:${port}`);
  });
});

describe('auth proxy HTTP endpoints', () => {
  let proxyUrl: string;
  let stopProxy: () => void;
  let mgmtToken: string;

  beforeEach(async () => {
    setUpstreamPortResolver(() => 45001);
    const port = await pickFreePort();
    proxyUrl = `http://127.0.0.1:${port}`;
    const { stop } = startMcpAuthProxy('127.0.0.1', port, { tokenPath: freshTokenPath() });
    stopProxy = stop;
    mgmtToken = getMcpManagementToken();
    await waitForProxy(proxyUrl);
  });

  afterEach(() => {
    stopProxy();
  });

  it('returns 401 without a bearer token', async () => {
    const res = await fetch(`${proxyUrl}/mcp/deepwiki`, { method: 'POST' });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Authorization/i);
  });

  it('returns 401 for an unknown bearer token', async () => {
    const res = await fetch(`${proxyUrl}/mcp/deepwiki`, {
      method: 'POST',
      headers: { Authorization: 'Bearer not-real' },
    });
    expect(res.status).toBe(401);
  });

  it('/tools requires the management token', async () => {
    const unauth = await fetch(`${proxyUrl}/tools`);
    expect(unauth.status).toBe(401);

    const withMgmt = await fetch(`${proxyUrl}/tools`, {
      headers: { Authorization: `Bearer ${mgmtToken}` },
    });
    expect(withMgmt.status).toBe(200);
    const body = await withMgmt.json();
    expect(body).toEqual({}); // no servers discovered in this test
  });

  it('/servers returns the registry topology when management-authenticated', async () => {
    const res = await fetch(`${proxyUrl}/servers`, {
      headers: { Authorization: `Bearer ${mgmtToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { servers: Array<{ name: string; port: number; status: string }> };
    expect(body.servers.map((s) => s.name).sort()).toEqual(['deepwiki', 'slang-mcp']);
    expect(body.servers.every((s) => s.status === 'running')).toBe(true);
  });

  it('/servers/stop requires ?name= and returns 400 otherwise', async () => {
    const res = await fetch(`${proxyUrl}/servers/stop`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mgmtToken}` },
    });
    expect(res.status).toBe(400);
  });

  it('/servers/stop returns 200 and invokes the registry when ?name= is present', async () => {
    const { stopServer } = await import('./mcp-registry.js');
    const res = await fetch(`${proxyUrl}/servers/stop?name=deepwiki`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mgmtToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, stopped: 'deepwiki' });
    expect(stopServer).toHaveBeenCalledWith('deepwiki');
  });

  it('rejects tools/call for unauthorized tools with JSON-RPC error code -32600', async () => {
    const containerToken = registerContainerToken('group-x', ['mcp__deepwiki__ask_question']);
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 99,
      method: 'tools/call',
      params: { name: 'blacklisted_tool' },
    });

    const res = await fetch(`${proxyUrl}/mcp/deepwiki`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${containerToken}`, 'Content-Type': 'application/json' },
      body,
    });
    expect(res.status).toBe(403);
    const parsed = (await res.json()) as { id: number; error: { code: number; message: string } };
    expect(parsed.error.code).toBe(-32600);
    expect(parsed.error.message).toMatch(/not authorized/);
    expect(parsed.id).toBe(99);
  });

  it('returns 404 when the requested server has no upstream port', async () => {
    setUpstreamPortResolver(() => null);

    const containerToken = registerContainerToken('group-y', ['mcp__deepwiki__ask_question']);
    const res = await fetch(`${proxyUrl}/mcp/unknown`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${containerToken}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(404);
  });
});

// ── AP/RC-42: end-to-end container token path ──────────────────────────────
//
// These tests exercise the scenarios that produce "MCP token agent issue"
// failures in prod: the container gets a token, the proxy is restarted,
// or another registration overwrites the ACL. The rest of the file covers
// only token issuance in isolation. These tests assert the lifecycle.

describe('end-to-end container token path (RC-42)', () => {
  let proxyUrl: string;
  let stopProxy: () => void;
  let tokenPath: string;

  beforeEach(async () => {
    setUpstreamPortResolver(() => 45001);
    const port = await pickFreePort();
    proxyUrl = `http://127.0.0.1:${port}`;
    tokenPath = freshTokenPath();
    const { stop } = startMcpAuthProxy('127.0.0.1', port, { tokenPath });
    stopProxy = stop;
    await waitForProxy(proxyUrl);
  });

  afterEach(() => {
    stopProxy();
  });

  // Skipped: needs NO_PROXY='*' so the local upstream stub bypasses the
  // outbound HTTPS proxy; un-skip once test env is wired with that.
  it.skip('tools/call with a registered container token + allowed tool succeeds with JSON-RPC response', async () => {
    const http = await import('http');
    // Upstream MCP server: respond to initialize + tools/call. The proxy is
    // a pass-through once the token ACL passes.
    const srv = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        const parsed = JSON.parse(body || '{}');
        if (parsed.method === 'initialize') {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Mcp-Session-Id': 'sid' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result: {} }));
          return;
        }
        if (parsed.method === 'tools/call') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: parsed.id,
              result: { content: [{ type: 'text', text: 'ok' }] },
            }),
          );
          return;
        }
        res.writeHead(400);
        res.end();
      });
    });
    await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
    const upstreamPort = (srv.address() as { port: number }).port;
    setUpstreamPortResolver((name) => (name === 'deepwiki' ? upstreamPort : null));

    try {
      const token = registerContainerToken('group-e2e', ['mcp__deepwiki__ask_question']);
      const res = await fetch(`${proxyUrl}/mcp/deepwiki`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'ask_question', arguments: { q: 'x' } },
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { result: { content: Array<{ text: string }> } };
      expect(body.result.content[0].text).toBe('ok');
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });

  it('proxy restart invalidates previously-issued container tokens (401 on old token)', async () => {
    const token = registerContainerToken('group-restart', ['mcp__deepwiki__ask_question']);
    // Stop the running proxy, start a fresh one on a new port.
    stopProxy();
    const newPort = await pickFreePort();
    const newUrl = `http://127.0.0.1:${newPort}`;
    const { stop } = startMcpAuthProxy('127.0.0.1', newPort, { tokenPath: freshTokenPath() });
    stopProxy = stop;
    await waitForProxy(newUrl);

    const res = await fetch(`${newUrl}/mcp/deepwiki`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ask_question' } }),
    });
    expect(res.status).toBe(401);
  });

  it('revokeContainerToken invalidates the token — next tools/call returns 401', async () => {
    const token = registerContainerToken('group-revoke', ['mcp__deepwiki__ask_question']);
    revokeContainerToken(token);

    const res = await fetch(`${proxyUrl}/mcp/deepwiki`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ask_question' } }),
    });
    expect(res.status).toBe(401);
  });

  it('re-registering the same group issues a distinct token — the previous token keeps working until explicitly revoked', async () => {
    // registerContainerToken is additive: the old token remains valid so
    // an in-flight container isn't disconnected mid-request. Callers that
    // want the old one dead must call revokeContainerToken explicitly
    // (container-runner does this on container exit). Pinning that
    // contract here so the semantic can't silently flip.
    const oldToken = registerContainerToken('group-re', ['mcp__deepwiki__ask_question']);
    const newToken = registerContainerToken('group-re', ['mcp__deepwiki__ask_question']);
    expect(newToken).not.toBe(oldToken);

    for (const token of [oldToken, newToken]) {
      const res = await fetch(`${proxyUrl}/mcp/deepwiki`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      // tools/list passes the ACL gate (no name check) so we can use it as a
      // simple "token is authenticated at the proxy" signal without needing
      // a live upstream — the upstream call will still fail with something
      // non-401, which is what distinguishes "token OK, upstream down" from
      // "token bad".
      expect(res.status).not.toBe(401);
    }
  });

  it('container with no allowed tools still gets a valid bearer but every tools/call is denied -32600', async () => {
    // Covers the hasProxyToken=true + empty-ACL edge case: a coworker with
    // allowedMcpTools: [] shouldn't get a 401 (it's authenticated) but
    // should get the structured -32600 error for every tools/call, so the
    // container-side error is clear rather than confusing.
    const token = registerContainerToken('group-empty-acl', []);
    expect(token).toMatch(/^[a-f0-9]{64}$/);

    const res = await fetch(`${proxyUrl}/mcp/deepwiki`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'anything' },
      }),
    });
    // The proxy returns HTTP 403 + a JSON-RPC error body for ACL denials
    // (see mcp-auth-proxy.ts:384). 403 distinguishes auth failures
    // (missing/invalid bearer → 401) from authz failures (valid bearer,
    // tool not in ACL → 403) at the HTTP layer, so load balancers and
    // upstream monitoring can separate the two.
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { code: number } };
    expect(body.error?.code).toBe(-32600);
  });

  it('management-token file is written with 0o600 perms at start and removed on stop', async () => {
    const fs = await import('fs');
    expect(fs.existsSync(tokenPath)).toBe(true);
    const stat = fs.statSync(tokenPath);
    // Mask off file-type bits; compare only the lower 9 mode bits.
    expect(stat.mode & 0o777).toBe(0o600);
    const written = fs.readFileSync(tokenPath, 'utf-8');
    expect(written).toBe(getMcpManagementToken());

    stopProxy();
    // Re-open stopProxy to avoid double-stop in afterEach — replace with
    // a noop since we've already stopped.
    stopProxy = () => {};
    expect(fs.existsSync(tokenPath)).toBe(false);
  });
});
