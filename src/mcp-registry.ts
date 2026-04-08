/**
 * MCP Server Registry for NanoClaw.
 *
 * Manages multiple MCP servers — each gets its own supergateway process
 * bound to loopback on an auto-assigned port.  The auth proxy routes
 * requests to the correct upstream by path prefix (/mcp/<serverName>).
 *
 * Servers are defined in config or auto-detected from container/mcp-servers/.
 */
import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { logger } from './logger.js';
import { readEnvFile } from './env.js';

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
}

// ── Registry ────────────────────────────────────────────────────────────────

const servers = new Map<string, RunningServer>();
let nextInternalPort = 0;

/**
 * Auto-detect stdio MCP servers from container/mcp-servers/ directory.
 * Each subdirectory with a pyproject.toml is a candidate.
 */
function detectStdioServers(): McpServerDef[] {
  const mcpDir = path.join(process.cwd(), 'container', 'mcp-servers');
  if (!fs.existsSync(mcpDir)) return [];

  const defs: McpServerDef[] = [];
  for (const entry of fs.readdirSync(mcpDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const serverDir = path.join(mcpDir, entry.name);
    if (!fs.existsSync(path.join(serverDir, 'pyproject.toml'))) continue;

    // Derive server name from directory (e.g. 'slang-mcp')
    const name = entry.name;

    // Per-server env vars: read from .env-vars file in the server directory.
    // No default env vars — each server declares only the tokens it needs.
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
      command: `uv run --directory ${serverDir} ${name}-server`,
      workDir: serverDir,
      envVars,
      auth: 'shared-token',
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
 * Returns a stop function that kills all processes.
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
    logger.info('No MCP servers detected');
    return { stop: () => {}, getUpstreamPort: () => null };
  }

  const supergwPath = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    'supergateway',
  );

  for (const def of defs) {
    if (def.type === 'stdio') {
      const port = nextInternalPort++;

      // Read tokens from .env
      const tokens = def.envVars ? readEnvFile(def.envVars) : {};
      if (Object.keys(tokens).length === 0 && def.auth === 'shared-token') {
        logger.info(
          { server: def.name },
          'No tokens configured, skipping MCP server',
        );
        continue;
      }

      const proc = spawn(
        supergwPath,
        [
          '--stdio',
          def.command!,
          '--outputTransport',
          'streamableHttp',
          '--port',
          String(port),
          '--host',
          '127.0.0.1',
        ],
        {
          env: { ...(process.env as Record<string, string>), ...tokens },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      proc.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) logger.debug({ server: def.name, msg }, 'MCP server stderr');
      });

      proc.on('error', (err) => {
        logger.error({ server: def.name, err }, 'MCP server failed to start');
      });

      proc.on('exit', (code) => {
        if (code !== null && code !== 0) {
          logger.warn(
            { server: def.name, code },
            'MCP server exited unexpectedly',
          );
        }
      });

      servers.set(def.name, { def, process: proc, upstreamPort: port });
      logger.info({ server: def.name, port }, 'MCP server started (loopback)');
    } else if (def.type === 'http' && def.url) {
      // Remote HTTP server — proxy through local supergateway so the auth
      // proxy can route to it like any other server
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
        {
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      proc.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg)
          logger.debug({ server: def.name, msg }, 'Remote MCP server stderr');
      });
      proc.on('error', (err) => {
        logger.error(
          { server: def.name, err },
          'Remote MCP server proxy failed to start',
        );
      });
      proc.on('exit', (code) => {
        if (code !== null && code !== 0) {
          logger.warn(
            { server: def.name, code },
            'Remote MCP server proxy exited unexpectedly',
          );
        }
      });

      servers.set(def.name, { def, process: proc, upstreamPort: port });
      logger.info(
        { server: def.name, port, url: def.url },
        'Remote MCP server proxied (loopback)',
      );
    }
  }

  // Wait for supergateway processes to initialize
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return {
    stop: () => {
      for (const [name, running] of servers) {
        if (running.process?.pid) {
          try {
            running.process.kill('SIGTERM');
          } catch {
            // Process already gone
          }
          logger.info({ server: name }, 'MCP server stopped');
        }
      }
      servers.clear();
    },
    getUpstreamPort: (name: string) => {
      return servers.get(name)?.upstreamPort ?? null;
    },
  };
}

/** Get all running server names. */
export function getRunningServerNames(): string[] {
  return [...servers.keys()];
}

/** Get a server's upstream port (loopback) by name. */
export function getServerUpstreamPort(name: string): number | null {
  return servers.get(name)?.upstreamPort ?? null;
}

/** Get a server's definition by name. */
export function getServerDef(name: string): McpServerDef | undefined {
  return servers.get(name)?.def;
}

/** Stop a running local MCP server (keeps definition for restart). */
export function stopServer(name: string): void {
  const running = servers.get(name);
  if (!running) throw new Error(`Server "${name}" not found`);
  if (running.process?.pid) {
    try {
      running.process.kill('SIGTERM');
    } catch {
      // Already gone
    }
    running.process = undefined;
    logger.info({ server: name }, 'MCP server stopped');
  }
}

/** Restart a local MCP server (stop + re-detect + start). */
export async function restartServer(name: string): Promise<void> {
  const running = servers.get(name);
  if (!running?.def) throw new Error(`Server "${name}" not found`);
  const def = running.def;
  const port = running.upstreamPort;

  // Stop
  stopServer(name);

  if (def.type !== 'stdio' || !port) return;

  // Re-start on the same port
  const supergwPath = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    'supergateway',
  );
  const tokens = def.envVars ? readEnvFile(def.envVars) : {};
  const proc = spawn(
    supergwPath,
    [
      '--stdio',
      def.command!,
      '--outputTransport',
      'streamableHttp',
      '--port',
      String(port),
      '--host',
      '127.0.0.1',
    ],
    {
      env: { ...(process.env as Record<string, string>), ...tokens },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  proc.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) logger.debug({ server: name, msg }, 'MCP server stderr');
  });
  proc.on('error', (err) => {
    logger.error({ server: name, err }, 'MCP server failed to restart');
  });

  servers.set(name, { def, process: proc, upstreamPort: port });
  await new Promise((resolve) => setTimeout(resolve, 2000));
  logger.info({ server: name, port }, 'MCP server restarted');
}
