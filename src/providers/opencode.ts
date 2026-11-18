/**
 * Host-side container config for the `opencode` provider.
 *
 * OpenCode's `opencode serve` process stores state under XDG_DATA_HOME, which
 * we pin to a per-session host directory mounted at /opencode-xdg. The
 * OPENCODE_* env vars tell the CLI which provider/model to use at runtime
 * (read on the host, injected into the container). NO_PROXY / no_proxy are
 * merged with host values so the in-container OpenCode client reaches
 * 127.0.0.1 and the host (host.docker.internal) directly even when the OneCLI
 * proxy variables are set. OpenCode honors HTTP_PROXY for plain http, so a list
 * without host.docker.internal sends the MCP proxy (:8808) and the dashboard
 * hook posts into the gateway, which cannot forward them.
 */
import fs from 'fs';
import path from 'path';

import { readEnvFile } from '../env.js';
import { registerProviderContainerConfig } from './provider-container-registry.js';

const PASSTHROUGH_KEYS = [
  'OPENCODE_PROVIDER',
  'OPENCODE_MODEL',
  'OPENCODE_SMALL_MODEL',
  'OPENCODE_BASE_URL',
  'ANTHROPIC_BASE_URL',
  'OPENCODE_MODEL_CONTEXT_LIMIT',
  'OPENCODE_MODEL_OUTPUT_LIMIT',
  'OPENCODE_MODEL_INPUT_MODALITIES',
  'OPENCODE_SERVER_START_TIMEOUT_MS',
  'OPENCODE_MCP_TIMEOUT_MS',
] as const;
const AUTH_MODE_KEY = 'OPENCODE_AUTH_MODE';

/** Host-local destinations that bypass the proxy: the same list container-runner sets for every container. */
const HOST_LOCAL_NO_PROXY = 'host.docker.internal,127.0.0.1,localhost';

function mergeNoProxy(current: string | undefined, additions: string): string {
  if (!current?.trim()) return additions;
  const parts = new Set(
    current
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  for (const addition of additions.split(',')) {
    const trimmed = addition.trim();
    if (trimmed) parts.add(trimmed);
  }
  return [...parts].join(',');
}

registerProviderContainerConfig('opencode', (ctx) => {
  const opencodeDir = path.join(ctx.sessionDir, 'opencode-xdg');
  if (!ctx.coreOwnsProviderSurfaces) fs.mkdirSync(opencodeDir, { recursive: true });

  const env: Record<string, string> = {
    XDG_DATA_HOME: '/opencode-xdg',
    NO_PROXY: mergeNoProxy(ctx.hostEnv.NO_PROXY, HOST_LOCAL_NO_PROXY),
    no_proxy: mergeNoProxy(ctx.hostEnv.no_proxy, HOST_LOCAL_NO_PROXY),
  };
  // The host process does not load `.env` into process.env (readEnvFile keeps
  // file values out of child processes), and the service units set no
  // EnvironmentFile — so under launchd/systemd, ctx.hostEnv carries none of
  // these. Fall back to the `.env` file the way the claude provider does;
  // a real exported variable still wins over the file.
  const dotenv = readEnvFile([...PASSTHROUGH_KEYS, AUTH_MODE_KEY]);
  for (const key of PASSTHROUGH_KEYS) {
    const value = ctx.hostEnv[key] ?? dotenv[key];
    if (value) env[key] = value;
  }

  const mounts = ctx.coreOwnsProviderSurfaces
    ? []
    : [{ hostPath: opencodeDir, containerPath: '/opencode-xdg', readonly: false }];
  const authMode: string | undefined = ctx.hostEnv[AUTH_MODE_KEY] ?? dotenv[AUTH_MODE_KEY];
  // The container initializes its own non-secret auth state before server startup.
  env[AUTH_MODE_KEY] = authMode === 'chatgpt' ? 'chatgpt' : 'api-key';

  return {
    mounts,
    env,
  };
});
