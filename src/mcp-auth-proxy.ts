/**
 * Authenticated MCP Proxy for NanoClaw.
 *
 * Sits in front of supergateway (bound to loopback) and enforces:
 *   1. Per-container Bearer token authentication
 *   2. Per-container tool-level access control (tools/call requests)
 *
 * Containers get a random token at spawn time, registered here with their
 * allowedMcpTools list.  Unauthenticated or unauthorized requests are rejected
 * at the network level — defense-in-depth on top of the SDK's disallowedTools.
 */
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { logger } from './logger.js';
import {
  getRunningServerNames,
  getServerUpstreamPort as getRegistryPort,
  restartServer,
  stopServer,
} from './mcp-registry.js';

// ── Token registry ──────────────────────────────────────────────────────────

interface TokenEntry {
  groupFolder: string;
  /** Scoped MCP tool names: <server>__<tool> (not raw tool names). */
  allowedTools: Set<string>;
}

// ── Management token (host-only, never given to containers) ────────────────
let managementToken: string = '';

/** Get the management token for host-side callers (dashboard, CLI). */
export function getMcpManagementToken(): string {
  return managementToken;
}

const tokens = new Map<string, TokenEntry>();

/**
 * Register a per-container token.  Called from container-runner before spawn.
 * Returns the generated bearer token.
 */
export function registerContainerToken(
  groupFolder: string,
  allowedMcpTools: string[],
): string {
  const token = crypto.randomBytes(32).toString('hex');
  // Keep server-scoped names: mcp__<server>__<tool> → <server>__<tool>
  // This prevents cross-server access when two servers expose the same tool name.
  const scopedNames = allowedMcpTools
    .filter((t) => t.startsWith('mcp__') && !t.startsWith('mcp__nanoclaw__'))
    .map((t) => {
      // mcp__<server>__tool_name  →  <server>__tool_name
      const parts = t.split('__');
      return parts.slice(1).join('__');
    });
  tokens.set(token, { groupFolder, allowedTools: new Set(scopedNames) });
  return token;
}

/** Remove a token when the container exits. */
export function revokeContainerToken(token: string): void {
  tokens.delete(token);
}

// ── Tool discovery ──────────────────────────────────────────────────────────

/** Cached tool inventories per MCP server, keyed by server name. */
const discoveredTools: Record<string, string[]> = {};

/**
 * Discover tools from an MCP server via JSON-RPC tools/list.
 * Called once after supergateway starts.  Results are cached.
 */
export async function discoverTools(
  serverName: string,
  upstreamPort: number,
): Promise<string[]> {
  const mcpRequest = (
    body: string,
    sessionId?: string,
  ): Promise<{ raw: string; sessionId?: string }> =>
    new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      };
      if (sessionId) headers['Mcp-Session-Id'] = sessionId;

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: upstreamPort,
          path: '/mcp',
          method: 'POST',
          headers,
        },
        (res) => {
          const sid = res.headers['mcp-session-id'] as string | undefined;
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () =>
            resolve({
              raw: Buffer.concat(chunks).toString(),
              sessionId: sid,
            }),
          );
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });

  const parseSSE = (raw: string): any => {
    const dataLines = raw.split('\n').filter((l) => l.startsWith('data: '));
    const jsonStr =
      dataLines.length > 0 ? dataLines[dataLines.length - 1].slice(6) : raw;
    return JSON.parse(jsonStr);
  };

  try {
    // Step 1: initialize — required by streamable HTTP transport
    const initBody = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'nanoclaw-discovery', version: '1.0' },
      },
    });
    const initRes = await mcpRequest(initBody);
    const sid = initRes.sessionId;
    // Step 2: tools/list using the session
    const listBody = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });
    const listRes = await mcpRequest(listBody, sid);
    const parsed = parseSSE(listRes.raw);

    if (parsed.result?.tools) {
      const toolNames = parsed.result.tools.map(
        (t: { name: string }) => t.name,
      );
      discoveredTools[serverName] = toolNames;
      logger.info(
        { server: serverName, count: toolNames.length },
        'MCP tool discovery complete',
      );
      return toolNames;
    }
  } catch (err) {
    logger.warn(
      { server: serverName, err: String(err) },
      'MCP tool discovery failed',
    );
  }

  logger.warn({ server: serverName }, 'MCP tool discovery: no tools returned');
  return [];
}

/**
 * Get the full discovered tool inventory for all MCP servers.
 * Returns tools in SDK-prefixed format: mcp__<server>__<tool>.
 */
export function getDiscoveredToolInventory(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [server, tools] of Object.entries(discoveredTools)) {
    result[server] = tools.map((t) => `mcp__${server}__${t}`);
  }
  return result;
}

// ── Auth proxy server ───────────────────────────────────────────────────────

let server: http.Server | null = null;

/** Resolve upstream port for a request URL.  Supports:
 *  - /mcp/<server-name>  → port from registry
 *  - /mcp                → first registered server (backwards compat)
 */
type PortResolver = (serverName: string | null) => number | null;
let resolveUpstreamPort: PortResolver = () => null;

/** Set the port resolver (called from index.ts after registry starts). */
export function setUpstreamPortResolver(resolver: PortResolver): void {
  resolveUpstreamPort = resolver;
}

/**
 * Start the authenticated MCP proxy.
 *
 * @param bindHost   Interface to bind on (docker bridge IP or 0.0.0.0)
 * @param listenPort Port containers connect to (MCP_PROXY_PORT)
 */
export function startMcpAuthProxy(
  bindHost: string,
  listenPort: number,
): { stop: () => void } {
  // Generate a dedicated management token for host-side callers
  managementToken = crypto.randomBytes(32).toString('hex');

  // Write token to runtime file so the dashboard process (separate service) can read it.
  // Must be outside the project root — the project root is mounted read-only into containers.
  const tokenPath = path.join(
    process.env.HOME || '/home/ubuntu',
    '.config',
    'nanoclaw',
    '.mcp-management-token',
  );
  try {
    fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
    fs.writeFileSync(tokenPath, managementToken, { mode: 0o600 });
  } catch (err) {
    logger.warn({ err }, 'Failed to write MCP management token file');
  }

  server = http.createServer((req, res) => {
    // ── Host-only management endpoints ─────────────────────────────────
    // Mutating management endpoints require the dedicated management token,
    // NOT a container token — this prevents containers from stopping/restarting
    // shared MCP servers.
    const isManagementEndpoint =
      req.url === '/tools' ||
      req.url === '/servers' ||
      (req.url || '').startsWith('/servers/stop') ||
      (req.url || '').startsWith('/servers/restart');

    if (isManagementEndpoint) {
      const isMutating = req.method === 'POST';
      if (isMutating) {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ')
          ? authHeader.slice(7)
          : null;
        if (!token || token !== managementToken) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }
      }
    }

    if (req.method === 'GET' && req.url === '/tools') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getDiscoveredToolInventory()));
      return;
    }

    // GET /servers — list running local MCP servers
    if (req.method === 'GET' && req.url === '/servers') {
      const servers = getRunningServerNames().map((name: string) => ({
        name,
        port: getRegistryPort(name),
        status: 'running',
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ servers }));
      return;
    }

    // POST /servers/stop?name=<name> — stop a local MCP server
    if (req.method === 'POST' && (req.url || '').startsWith('/servers/stop')) {
      const serverName = new URL(
        req.url || '',
        'http://localhost',
      ).searchParams.get('name');
      if (!serverName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing ?name= parameter' }));
        return;
      }
      try {
        stopServer(serverName);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, stopped: serverName }));
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // POST /servers/restart?name=<name> — restart a local MCP server
    if (
      req.method === 'POST' &&
      (req.url || '').startsWith('/servers/restart')
    ) {
      const serverName = new URL(
        req.url || '',
        'http://localhost',
      ).searchParams.get('name');
      if (!serverName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing ?name= parameter' }));
        return;
      }
      restartServer(serverName)
        .then(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, restarted: serverName }));
        })
        .catch((e: Error) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        });
      return;
    }

    // ── Authenticate ──────────────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      );
      return;
    }

    const bearerToken = authHeader.slice(7);
    const entry = tokens.get(bearerToken);
    if (!entry) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid token' }));
      return;
    }

    // ── Resolve upstream server from URL path (needed for ACL scoping) ──
    // /mcp/<server-name> → server "<server-name>", upstream path /mcp
    // /mcp           → first registered server (backwards compat)
    const urlPath = req.url || '/mcp';
    const pathMatch = urlPath.match(/^\/mcp\/([^/]+)(\/.*)?$/);
    const serverName = pathMatch ? pathMatch[1] : null;
    const upstreamPath = pathMatch ? `/mcp${pathMatch[2] || ''}` : urlPath;
    const upstreamPort = resolveUpstreamPort(serverName);

    // ── Collect request body for tool ACL check ─────────────────────
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);

      // Check tool-level ACL on tools/call requests (scoped by server name)
      if (body.length > 0) {
        try {
          const parsed = JSON.parse(body.toString());
          if (parsed.method === 'tools/call' && parsed.params?.name) {
            const toolName: string = parsed.params.name;
            // Build server-scoped key: <server>__<tool> to prevent cross-server access
            const scopedKey = serverName
              ? `${serverName}__${toolName}`
              : toolName;
            if (!entry.allowedTools.has(scopedKey)) {
              logger.warn(
                {
                  group: entry.groupFolder,
                  tool: scopedKey,
                  allowed: [...entry.allowedTools],
                },
                'MCP auth proxy: tool call blocked',
              );
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: parsed.id,
                  error: {
                    code: -32600,
                    message: `Tool "${toolName}" is not authorized for this agent on server "${serverName}"`,
                  },
                }),
              );
              return;
            }
          }
        } catch {
          // Not valid JSON — pass through (could be SSE init or other)
        }
      }

      if (!upstreamPort) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: serverName
              ? `MCP server "${serverName}" not found`
              : 'No MCP servers available',
          }),
        );
        return;
      }

      // ── Proxy to upstream supergateway ──────────────────────────────
      const upstreamHeaders = { ...req.headers };
      delete upstreamHeaders.authorization;
      upstreamHeaders.host = `127.0.0.1:${upstreamPort}`;

      const proxyReq = http.request(
        {
          hostname: '127.0.0.1',
          port: upstreamPort,
          path: upstreamPath,
          method: req.method,
          headers: upstreamHeaders,
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(res);
        },
      );

      proxyReq.on('error', (err) => {
        logger.error({ err }, 'MCP auth proxy: upstream error');
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Upstream MCP server unavailable' }));
        }
      });

      if (body.length > 0) {
        proxyReq.write(body);
      }
      proxyReq.end();
    });
  });

  server.listen(listenPort, bindHost, () => {
    logger.info({ port: listenPort, host: bindHost }, 'MCP auth proxy started');
  });

  return {
    stop: () => {
      if (server) {
        server.close();
        server = null;
      }
      tokens.clear();
      managementToken = '';
      try {
        fs.unlinkSync(
          path.join(process.cwd(), 'data', '.mcp-management-token'),
        );
      } catch {
        /* already gone */
      }
    },
  };
}
