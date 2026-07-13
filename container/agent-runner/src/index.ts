/**
 * NanoClaw Agent Runner v2
 *
 * Runs inside a container. All IO goes through the session DB.
 * No stdin, no stdout markers, no IPC files.
 *
 * Config:
 *   - SESSION_INBOUND_DB_PATH:  path to host-owned inbound DB (default: /workspace/inbound.db)
 *   - SESSION_OUTBOUND_DB_PATH: path to container-owned outbound DB (default: /workspace/outbound.db)
 *   - SESSION_HEARTBEAT_PATH:   heartbeat file path (default: /workspace/.heartbeat)
 *   - AGENT_PROVIDER: any registered provider name (default: claude). The
 *     set of registered providers is whatever `providers/index.ts` imports.
 *   - NANOCLAW_ASSISTANT_NAME: assistant name for transcript archiving
 *   - NANOCLAW_ADMIN_USER_IDS: comma-separated user IDs allowed to run admin commands
 *
 * Mount structure:
 *   /workspace/
 *     inbound.db        ← host-owned session DB (container reads only)
 *     outbound.db       ← container-owned session DB
 *     .heartbeat        ← container touches for liveness detection
 *     outbox/           ← outbound files
 *     agent/            ← agent group folder (CLAUDE.md, skills, working files)
 *     .claude/          ← Claude SDK session data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadConfig } from './config.js';
import { buildSystemPromptAddendum } from './destinations.js';
import { ensureMemoryScaffold } from './memory-scaffold.js';
// Providers barrel — each enabled provider self-registers on import.
// Provider skills append imports to providers/index.ts.
import './providers/index.js';
import { createCodexConfigOverrides } from './providers/codex-app-server.js';
import { createProvider, type ProviderName } from './providers/factory.js';
import { parseAllowedMcpTools } from './providers/claude.js';
import { runPollLoop } from './poll-loop.js';

function log(msg: string): void {
  console.error(`[agent-runner] ${msg}`);
}

const CWD = '/workspace/agent';

/**
 * Discover directories to pass to the SDK as `additionalDirectories`:
 *   - every immediate subdir of `/workspace/extra` (host-mounted extras), and
 *   - every immediate subdir of CWD that carries its own `.claude/` (a cloned
 *     repo bringing skills/commands/CLAUDE.md).
 *
 * The SDK loads each additional directory's `.claude/agents/` and `CLAUDE.md`.
 * A writer tier accumulates many git *worktrees* of the SAME repo under CWD
 * (e.g. `wt-slang-*`), and each worktree carries an identical `.claude/`. Adding
 * every worktree re-registers the repo's subagents and re-injects its CLAUDE.md
 * once PER worktree, every turn — 50+ duplicate copies that refill the context
 * window and drive autocompaction thrash. So we include a repo's PRIMARY
 * checkout but skip its linked worktrees: a worktree's `.git` is a FILE (a
 * gitdir pointer), a primary clone's `.git` is a DIRECTORY.
 */
export function discoverAdditionalDirectories(
  bases: string[],
  cwd: string,
): string[] {
  const out: string[] = [];
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base)) {
      const fullPath = path.join(base, entry);
      try {
        if (!fs.statSync(fullPath).isDirectory()) continue;
      } catch {
        continue;
      }
      // For CWD subdirs, only include if they have .claude/ (skills, commands, CLAUDE.md)…
      if (base === cwd) {
        if (!fs.existsSync(path.join(fullPath, '.claude'))) continue;
        // …and skip linked git worktrees — their `.git` is a file, not a dir.
        // All N worktrees of a repo carry the same `.claude/`; adding each one
        // duplicates the repo's agents + CLAUDE.md N times and thrashes context.
        try {
          const gitPath = path.join(fullPath, '.git');
          if (fs.existsSync(gitPath) && fs.statSync(gitPath).isFile()) continue;
        } catch {
          /* if we can't stat .git, fall through and include the dir */
        }
      }
      out.push(fullPath);
    }
  }
  return out;
}

async function main(): Promise<void> {
  // Load /workspace/agent/container.json once at startup. Without this call,
  // getConfig() throws on first read, leaving features like maxMessagesPerPrompt
  // stuck on the hardcoded fallback. Safe to call multiple times (memoized).
  const config = loadConfig();

  const providerName = (process.env.AGENT_PROVIDER || 'claude').toLowerCase() as ProviderName;
  const assistantName = process.env.NANOCLAW_ASSISTANT_NAME;

  log(`Starting v2 agent-runner (provider: ${providerName})`);

  // Build the system context instructions.
  // Claude Code loads CLAUDE.md natively from the filesystem; Codex loads it
  // in its own provider (codex.ts:composeBaseInstructions). index.ts only
  // provides the routing addendum — CLAUDE.md ownership lives in the provider.
  const instructions = buildSystemPromptAddendum();

  // Discover additional directories: /workspace/extra/* (host-mounted) and
  // /workspace/agent/* subdirs with their own .claude/ (cloned repos), skipping
  // linked git worktrees so a repo's .claude/ isn't registered once per worktree
  // (that duplication thrashes the context window — see the helper's doc).
  const additionalDirectories = discoverAdditionalDirectories(['/workspace/extra', CWD], CWD);
  if (additionalDirectories.length > 0) {
    log(`Additional directories: ${additionalDirectories.join(', ')}`);
  }

  // MCP server path — bun runs TS directly; no tsc build step in-image.
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mcpServerPath = path.join(__dirname, 'mcp-tools', 'index.ts');

  // Build MCP servers config: nanoclaw built-in + codex stdio child + any
  // additional from host. The codex entry runs the local codex CLI as an
  // MCP child process so it can read /workspace/agent files directly when
  // it reviews. Routing/auth come from `-c` overrides built from container
  // env vars — no ~/.codex/config.toml file is needed.
  const codexArgs: string[] = [];
  for (const override of createCodexConfigOverrides()) {
    codexArgs.push('-c', override);
  }
  codexArgs.push('mcp-server');
  const mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string>; envInherit?: string[] }> = {
    nanoclaw: {
      command: 'bun',
      args: ['run', mcpServerPath],
      env: {
        SESSION_INBOUND_DB_PATH: process.env.SESSION_INBOUND_DB_PATH || '/workspace/inbound.db',
        SESSION_OUTBOUND_DB_PATH: process.env.SESSION_OUTBOUND_DB_PATH || '/workspace/outbound.db',
        SESSION_HEARTBEAT_PATH: process.env.SESSION_HEARTBEAT_PATH || '/workspace/.heartbeat',
      },
    },
    codex: {
      command: 'codex',
      args: codexArgs,
      // Env for the `codex mcp-server` subprocess.
      //
      // Two mechanisms to get variables to the child:
      //   1. `env` — literal key=value pairs, serialized verbatim into
      //      `[mcp_servers.codex.env]` in ~/.codex/config.toml.
      //      Used ONLY for non-secret, non-sensitive values (HOME, PATH).
      //   2. `envInherit` — names-only allowlist, serialized as
      //      `env_vars = [...]`. codex-cli resolves each name from its
      //      own process env at subprocess spawn time — values never
      //      reach disk. Used for anything derived from OneCLI/secrets
      //      (proxy token in HTTPS_PROXY authority, NVIDIA_API_KEY).
      //
      // Why NVIDIA_API_KEY has to be forwarded at all — even though
      // OneCLI handles auth transparently:
      //
      // OneCLI's HTTPS proxy DOES swap secrets transparently at the TLS
      // layer (the value in container env is usually `onecli-placeholder`,
      // not a real token — the real secret never enters the container).
      // BUT codex-cli validates `model_providers.<p>.env_key` at SESSION
      // START — before any HTTP call is attempted. If the named env var
      // is undefined it errors `Missing environment variable: NVIDIA_API_KEY`
      // and the subprocess exits before OneCLI gets a chance to inject.
      // The var must therefore be *defined* in the child env (placeholder
      // is fine); OneCLI rewrites the Authorization header on the way out.
      //
      // Verified empirically 2026-05-07 via `codex exec` A/B test:
      //   - without the var → codex errors at startup
      //   - with `onecli-placeholder` → request reaches nvinference, OneCLI
      //     swaps credentials, succeeds.
      //
      // envInherit forwards by NAME only, so even if the host passes a
      // real NVIDIA_API_KEY (uncommon), it never lands in TOML.
      // OPENAI_API_KEY is intentionally NOT forwarded — codex is routed
      // through nvinference per the deployment's credential policy.
      env: {
        HOME: process.env.HOME ?? '/home/node',
        PATH: process.env.PATH ?? '',
      },
      envInherit: [
        'NVIDIA_API_KEY',
        'HTTPS_PROXY',
        'HTTP_PROXY',
        'NO_PROXY',
        'SSL_CERT_FILE',
        'SSL_CERT_DIR',
        'NODE_EXTRA_CA_CERTS',
      ],
    },
  };

  // Merge additional MCP servers from host configuration
  if (process.env.NANOCLAW_MCP_SERVERS) {
    try {
      const additional = JSON.parse(process.env.NANOCLAW_MCP_SERVERS) as Record<string, { command: string; args: string[]; env: Record<string, string> }>;
      for (const [name, config] of Object.entries(additional)) {
        mcpServers[name] = config;
        log(`Additional MCP server: ${name} (${config.command})`);
      }
    } catch (e) {
      log(`Failed to parse NANOCLAW_MCP_SERVERS: ${e}`);
    }
  }

  // MCP proxy integration: add proxy-connected servers for allowed MCP tools
  const allowedMcpTools = parseAllowedMcpTools(process.env as Record<string, string | undefined>);
  if (allowedMcpTools.length > 0 && process.env.MCP_PROXY_URL) {
    log('Using legacy MCP proxy auto-discovery from allowed tool names; prefer explicit NANOCLAW_MCP_SERVERS provisioning for HTTP MCP servers.');
    // Derive which MCP servers to connect based on allowed tool prefixes
    const neededServers = new Set<string>();
    for (const tool of allowedMcpTools) {
      // Split on __ delimiter: mcp__<server>__<tool>
      const parts = tool.split('__');
      if (parts.length >= 3 && parts[0] === 'mcp' && parts[1] !== 'nanoclaw') {
        neededServers.add(parts[1]);
      }
    }

    for (const serverName of neededServers) {
      // Don't overwrite a server that's already wired (e.g. the hardcoded
      // codex stdio entry above). Auto-discovery only fills in proxy-routed
      // servers we haven't already provisioned explicitly.
      if (mcpServers[serverName]) continue;
      const baseUrl = process.env.MCP_PROXY_URL!.replace(/\/$/, '');
      const serverUrl = `${baseUrl}/mcp/${serverName}`;
      const serverConfig: Record<string, unknown> = {
        type: 'http',
        url: serverUrl,
      };
      const headers: Record<string, string> = {
        Accept: 'application/json, text/event-stream',
      };
      if (process.env.MCP_PROXY_TOKEN) {
        // Claude SDK-native: plaintext Authorization header
        headers.Authorization = `Bearer ${process.env.MCP_PROXY_TOKEN}`;
        // Codex-friendly: env-var indirection so the token isn't written
        // into ~/.codex/config.toml as plaintext. Codex emits
        // `bearer_token_env_var = "MCP_PROXY_TOKEN"` and reads from the
        // subprocess env (forwarded below) at request time.
        serverConfig.bearerTokenEnvVar = 'MCP_PROXY_TOKEN';
      }
      serverConfig.headers = headers;
      mcpServers[serverName] = serverConfig as any;
      log(`MCP proxy server: ${serverName} via ${serverUrl}`);
    }
  }

  const provider = createProvider(providerName, {
    assistantName,
    mcpServers,
    env: { ...process.env },
    additionalDirectories: additionalDirectories.length > 0 ? additionalDirectories : undefined,
    model: config.model,
    effort: config.effort,
    fallbackModel: config.fallbackModel,
  });

  // Providers that lack native memory opt in via `usesMemoryScaffold`; for them
  // the runner creates a persistent memory/ tree in its host-backed workspace at
  // boot (idempotent). Default off — the trunk default (Claude) omits the flag
  // and keeps its native memory untouched.
  if (provider.usesMemoryScaffold) ensureMemoryScaffold();

  await runPollLoop({
    provider,
    providerName,
    cwd: CWD,
    systemContext: { instructions },
  });
}

// Only auto-run when invoked as the entrypoint — not when imported (e.g. by
// tests that exercise the pure helpers above without booting the poll loop).
if (import.meta.main) {
  main().catch((err) => {
    log(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
