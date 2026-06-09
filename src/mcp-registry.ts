/**
 * MCP Server Registry for NanoClaw v2.
 *
 * Manages multiple MCP servers — each gets its own supergateway process
 * bound to loopback on an auto-assigned port.  The auth proxy routes
 * requests to the correct upstream by path prefix (/mcp/<serverName>).
 *
 * Servers are defined in config or auto-detected from container/mcp-servers/.
 */
import { ChildProcess, execSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { OneCLI } from '@onecli-sh/sdk';

import { log } from './log.js';
import { CONTAINER_PREFIX, ONECLI_URL } from './config.js';
import { readEnvFile } from './env.js';
import { clearDiscoveredTools, discoverTools } from './mcp-auth-proxy.js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface McpServerDef {
  /** Unique server name used in URL paths and tool prefixes. */
  name: string;
  /** 'stdio' = local process via supergateway; 'http' = remote URL. */
  type: 'stdio' | 'http';
  /** For stdio: shell command to run the server. */
  command?: string;
  /** For stdio: working directory. */
  workDir?: string;
  /** For stdio: env var names to read from .env and pass to the server. */
  envVars?: string[];
  /** For http: upstream URL (e.g. https://mcp.deepwiki.com/mcp). */
  url?: string;
  /** Auth method: 'none', 'shared-token' (env var), 'per-user-oauth'. */
  auth?: 'none' | 'shared-token' | 'per-user-oauth';
}

interface RunningServer {
  def: McpServerDef;
  process?: ChildProcess;
  /** Loopback port for stdio servers, or null for remote HTTP. */
  upstreamPort: number | null;
  alive: boolean;
}

// ── OneCLI proxy for host-side MCP servers ─────────────────────────────────

let _onecliProxyEnvCache: Record<string, string> | null = null;

async function getOneCLIProxyEnv(): Promise<Record<string, string> | null> {
  if (_onecliProxyEnvCache) return _onecliProxyEnvCache;
  if (!ONECLI_URL) return null;

  try {
    const onecli = new OneCLI({ url: ONECLI_URL });
    const config = await onecli.getContainerConfig();

    // Scope the file name by CONTAINER_PREFIX (`nc-prod`, `nc-lego`, `nc-dev`,
    // etc.) so multiple nanoclaw installs sharing this host don't clobber each
    // other's OneCLI CA bundle. Each install's OneCLI mints its own MITM CA;
    // trusting the bundle written by the most-recently-restarted install
    // produces "self-signed certificate in certificate chain" errors for every
    // other install's MCP servers on the host.
    const combinedCaPath = path.join(os.tmpdir(), `nanoclaw-${CONTAINER_PREFIX}-onecli-mcp-ca.pem`);
    let systemCa = '';
    const systemCaPath = '/etc/ssl/certs/ca-certificates.crt';
    if (fs.existsSync(systemCaPath)) {
      systemCa = fs.readFileSync(systemCaPath, 'utf-8');
    }
    fs.writeFileSync(combinedCaPath, systemCa + '\n' + config.caCertificate, { mode: 0o644 });

    const rewriteProxy = (url: string) => url.replace(/host\.docker\.internal/g, '127.0.0.1');

    _onecliProxyEnvCache = {
      HTTPS_PROXY: rewriteProxy(config.env.HTTPS_PROXY || ''),
      HTTP_PROXY: rewriteProxy(config.env.HTTP_PROXY || ''),
      https_proxy: rewriteProxy(config.env.https_proxy || ''),
      http_proxy: rewriteProxy(config.env.http_proxy || ''),
      SSL_CERT_FILE: combinedCaPath,
      REQUESTS_CA_BUNDLE: combinedCaPath,
      NODE_EXTRA_CA_CERTS: combinedCaPath,
    };

    log.info('OneCLI proxy env prepared for MCP servers', { caPath: combinedCaPath });
    return _onecliProxyEnvCache;
  } catch (err) {
    log.warn('Failed to get OneCLI proxy config for MCP servers', { err });
    return null;
  }
}

// ── Registry ────────────────────────────────────────────────────────────────

const servers = new Map<string, RunningServer>();
let nextInternalPort = 0;

/**
 * Auto-detect stdio MCP servers from container/mcp-servers/ directory.
 * Convention:
 *   - Python: subdirectory with pyproject.toml → `uv run <name>-server`
 */
function detectStdioServers(): McpServerDef[] {
  const mcpDir = path.join(process.cwd(), 'container', 'mcp-servers');
  if (!fs.existsSync(mcpDir)) return [];

  const defs: McpServerDef[] = [];
  for (const entry of fs.readdirSync(mcpDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const serverDir = path.join(mcpDir, entry.name);
    const name = entry.name;

    const hasPyproject = fs.existsSync(path.join(serverDir, 'pyproject.toml'));
    if (!hasPyproject) continue;

    const command = `uv run --directory ${serverDir} ${name}-server`;

    // Per-server env vars: read from .env-vars file in the server directory.
    const envVarsFile = path.join(serverDir, '.env-vars');
    let envVars: string[] = [];
    if (fs.existsSync(envVarsFile)) {
      envVars = fs
        .readFileSync(envVarsFile, 'utf-8')
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('#'));
    }

    defs.push({
      name,
      type: 'stdio',
      command,
      workDir: serverDir,
      envVars,
      auth: envVars.length > 0 ? 'shared-token' : 'none',
    });
  }
  return defs;
}

/**
 * Auto-detect remote HTTP MCP servers from REMOTE_MCP_SERVERS env var.
 * Format: comma-separated "name|url" pairs, e.g. "deepwiki|https://mcp.deepwiki.com/mcp"
 */
function detectRemoteServers(): McpServerDef[] {
  const raw = process.env.REMOTE_MCP_SERVERS || '';
  if (!raw) return [];
  return raw
    .split(',')
    .filter(Boolean)
    .map((entry) => {
      const [name, url] = entry.split('|').map((s) => s.trim());
      return { name, type: 'http' as const, url, auth: 'none' as const };
    })
    .filter((d) => d.name && d.url);
}

/**
 * Start all registered MCP servers.
 * Stdio servers get a supergateway process on loopback.
 * Remote HTTP servers get a supergateway proxy on loopback.
 *
 * @param baseInternalPort Starting port for loopback supergateway instances.
 */
export async function startMcpServers(baseInternalPort: number): Promise<{
  stop: () => void;
  getUpstreamPort: (name: string) => number | null;
}> {
  nextInternalPort = baseInternalPort;

  const defs = [...detectStdioServers(), ...detectRemoteServers()];
  if (defs.length === 0) {
    log.info('No MCP servers detected');
    return { stop: () => {}, getUpstreamPort: () => null };
  }

  const onecliProxyEnv = await getOneCLIProxyEnv();

  const supergwPath = path.join(process.cwd(), 'node_modules', '.bin', 'supergateway');

  for (const def of defs) {
    if (def.type === 'stdio') {
      const port = nextInternalPort++;

      const tokens = def.envVars ? readEnvFile(def.envVars) : {};
      const hasSomeTokens = Object.keys(tokens).length > 0;

      if (!hasSomeTokens && def.auth === 'shared-token') {
        if (onecliProxyEnv) {
          for (const varName of def.envVars || []) {
            if (!tokens[varName]) tokens[varName] = 'onecli-placeholder';
          }
          log.info('MCP server using OneCLI proxy for credentials', { server: def.name });
        } else {
          log.info('No tokens configured, skipping MCP server', { server: def.name });
          continue;
        }
      }

      const proc = spawn(
        supergwPath,
        [
          '--stdio',
          def.command!,
          '--outputTransport',
          'streamableHttp',
          '--stateful',
          // --sessionTimeout: idle sessions are reaped after this many ms.
          // Without it, supergateway only deletes a session when the client
          // explicitly terminates — but our containers die abruptly (host-sweep
          // claude-md-stale → docker kill, request_restart → docker kill,
          // absolute-ceiling, heartbeat timeout). The MCP session is never
          // gracefully closed → stdio child (sh→uv→python slang-mcp-server)
          // leaks forever. 10 min covers normal idle gaps in active sessions
          // while reaping abandoned ones promptly. Tune via env if needed.
          '--sessionTimeout',
          // Parse env to int and fall back to 600000 if invalid. systemd's
          // EnvironmentFile passes `KEY=val # comment` literally — without
          // this sanitization, an inline comment would make supergateway
          // reject the value and silently disable the timeout entirely.
          String(parseInt(process.env.MCP_SESSION_TIMEOUT_MS || '', 10) || 600000),
          '--port',
          String(port),
          '--host',
          '127.0.0.1',
        ],
        {
          env: { ...(process.env as Record<string, string>), ...tokens, ...onecliProxyEnv },
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true,
        },
      );

      proc.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) log.debug('MCP server stderr', { server: def.name, msg });
      });

      proc.on('error', (err) => {
        log.error('MCP server failed to start', { server: def.name, err });
      });

      proc.on('exit', (code) => {
        const entry = servers.get(def.name);
        if (entry) entry.alive = false;
        clearDiscoveredTools(def.name);
        // Reap any descendants left behind. supergateway's child tree
        // (sh → uv → python) often survives the parent — without this,
        // each restart leaks one tree (see reapProcessTree comment).
        if (proc.pid) reapProcessTree(proc.pid, { server: def.name, on: 'exit' });
        if (code !== null && code !== 0) {
          log.warn('MCP server exited unexpectedly', { server: def.name, code });
        }
      });

      servers.set(def.name, { def, process: proc, upstreamPort: port, alive: true });
      log.info('MCP server started (loopback)', { server: def.name, port });
    } else if (def.type === 'http' && def.url) {
      const port = nextInternalPort++;
      const proc = spawn(
        supergwPath,
        [
          '--streamableHttp',
          def.url,
          '--outputTransport',
          'streamableHttp',
          '--port',
          String(port),
          '--host',
          '127.0.0.1',
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );

      proc.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) log.debug('Remote MCP server stderr', { server: def.name, msg });
      });
      proc.on('error', (err) => {
        log.error('Remote MCP server proxy failed to start', { server: def.name, err });
      });
      proc.on('exit', (code) => {
        const entry = servers.get(def.name);
        if (entry) entry.alive = false;
        clearDiscoveredTools(def.name);
        if (code !== null && code !== 0) {
          log.warn('Remote MCP server proxy exited unexpectedly', { server: def.name, code });
        }
      });

      servers.set(def.name, { def, process: proc, upstreamPort: port, alive: true });
      log.info('Remote MCP server proxied (loopback)', { server: def.name, port, url: def.url });
    }
  }

  // Wait for supergateway processes to initialize (Python servers need longer)
  await new Promise((resolve) => setTimeout(resolve, 5000));

  return {
    stop: () => {
      for (const [name, running] of servers) {
        if (running.process?.pid) {
          reapProcessTree(running.process.pid, { server: name });
          log.info('MCP server stopped', { server: name });
        }
      }
      servers.clear();
    },
    getUpstreamPort: (name: string) => {
      return servers.get(name)?.upstreamPort ?? null;
    },
  };
}

/** Get all alive server names. */
export function getRunningServerNames(): string[] {
  return [...servers.entries()].filter(([, s]) => s.alive).map(([name]) => name);
}

/** Get server status by name. */
export function isServerAlive(name: string): boolean {
  return servers.get(name)?.alive ?? false;
}

/** Get a server's upstream port (loopback) by name. */
export function getServerUpstreamPort(name: string): number | null {
  return servers.get(name)?.upstreamPort ?? null;
}

/** Get a server's definition by name. */
export function getServerDef(name: string): McpServerDef | undefined {
  return servers.get(name)?.def;
}

/**
 * Reap a process and ALL its descendants. Without this, supergateway's child
 * tree (sh → uv → python) survives a process-group SIGTERM because uv/python
 * call setsid(), escaping supergateway's group. Result: each /servers/restart
 * leaves a live python slang-mcp-server connected to upstream APIs (Discord
 * Gateway, etc.), accumulating until the host runs out of file descriptors,
 * memory, or duplicate Discord button posts give the leak away.
 *
 * Strategy:
 *   1. SIGTERM the supergateway process group (best-effort, gives clean
 *      shutdown to anything that listens to its parent group)
 *   2. Walk the descendant tree via `pgrep -P` and SIGKILL every PID
 *   3. SIGKILL the supergateway itself
 */
function reapProcessTree(rootPid: number, logCtx: Record<string, unknown> = {}): void {
  const descendants = collectDescendantPids(rootPid);

  // Step 1: best-effort SIGTERM the process group
  try {
    process.kill(-rootPid, 'SIGTERM');
  } catch {
    /* group already dead or pid invalid */
  }

  // Step 2: SIGKILL each descendant by PID. Order: leaves first, then up.
  // Reverse the BFS order so leaves get killed before their parents — avoids
  // momentary re-parenting to init while we're walking.
  for (const pid of [...descendants].reverse()) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  }

  // Step 3: SIGKILL the root
  try {
    process.kill(rootPid, 'SIGKILL');
  } catch {
    /* already gone */
  }

  if (descendants.length > 0) {
    log.info('Reaped MCP supergateway subtree', {
      ...logCtx,
      rootPid,
      descendantCount: descendants.length,
    });
  }
}

/** Walk a process subtree via `pgrep -P`. Returns descendants in BFS order. */
function collectDescendantPids(rootPid: number): number[] {
  const all: number[] = [];
  const queue: number[] = [rootPid];
  while (queue.length > 0) {
    const parent = queue.shift()!;
    try {
      const out = execSync(`pgrep -P ${parent} 2>/dev/null || true`, { encoding: 'utf-8' });
      const direct = out
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isFinite(n));
      all.push(...direct);
      queue.push(...direct);
    } catch {
      /* pgrep unavailable or no children */
    }
  }
  return all;
}

/** Stop a running local MCP server (keeps definition for restart). */
export function stopServer(name: string): void {
  const running = servers.get(name);
  if (!running) throw new Error(`Server "${name}" not found`);
  running.alive = false;
  clearDiscoveredTools(name);
  if (running.process?.pid) {
    reapProcessTree(running.process.pid, { server: name });
    running.process = undefined;
    log.info('MCP server stopped', { server: name });
  }
}

/** Restart an MCP server (stop + re-start). Works for both stdio and remote HTTP servers. */
export async function restartServer(name: string): Promise<void> {
  const running = servers.get(name);
  if (!running?.def) throw new Error(`Server "${name}" not found`);
  const def = running.def;
  const port = running.upstreamPort;
  if (!port) throw new Error(`Server "${name}" has no assigned port`);

  stopServer(name);

  const supergwPath = path.join(process.cwd(), 'node_modules', '.bin', 'supergateway');

  const proxyEnv = await getOneCLIProxyEnv();

  let proc: ReturnType<typeof spawn>;
  if (def.type === 'stdio') {
    const tokens = def.envVars ? readEnvFile(def.envVars) : {};
    if (proxyEnv) {
      for (const varName of def.envVars || []) {
        if (!tokens[varName]) tokens[varName] = 'onecli-placeholder';
      }
    }
    proc = spawn(
      supergwPath,
      [
        '--stdio',
        def.command!,
        '--outputTransport',
        'streamableHttp',
        '--stateful',
        // See startMcpServers above for why --sessionTimeout is required.
        '--sessionTimeout',
        process.env.MCP_SESSION_TIMEOUT_MS || '600000',
        '--port',
        String(port),
        '--host',
        '127.0.0.1',
      ],
      {
        env: { ...(process.env as Record<string, string>), ...tokens, ...proxyEnv },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      },
    );
  } else if (def.type === 'http' && def.url) {
    proc = spawn(
      supergwPath,
      [
        '--streamableHttp',
        def.url,
        '--outputTransport',
        'streamableHttp',
        '--port',
        String(port),
        '--host',
        '127.0.0.1',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } else {
    throw new Error(`Server "${name}" has unknown type: ${def.type}`);
  }

  proc.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) log.debug('MCP server stderr', { server: name, msg });
  });
  proc.on('error', (err) => {
    const entry = servers.get(name);
    if (entry) entry.alive = false;
    log.error('MCP server failed to restart', { server: name, err });
  });
  proc.on('exit', (code) => {
    const entry = servers.get(name);
    if (entry) entry.alive = false;
    clearDiscoveredTools(name);
    if (proc.pid) reapProcessTree(proc.pid, { server: name, on: 'exit' });
    if (code !== null && code !== 0) {
      log.warn('Restarted MCP server exited unexpectedly', { server: name, code });
    }
  });

  servers.set(name, { def, process: proc, upstreamPort: port, alive: true });
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Rediscover tools after restart (server may have changed)
  await discoverTools(name, port).catch((err) => {
    log.warn('Tool rediscovery failed after restart', { server: name, err });
  });

  log.info('MCP server restarted', { server: name, port });
}
