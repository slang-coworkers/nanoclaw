/**
 * Host-side container config for the `codex` provider.
 *
 * Per-session ~/.codex state (sessions/, auth.json, etc.) is mounted
 * UNIVERSALLY by container-runner.ts — not just for codex-provider
 * coworkers — because Claude-provider coworkers also call codex via
 * `mcp__codex__codex` (codex-critique skill) and `codex exec`
 * (buddy-call.sh) and need the same persistence for cost accounting +
 * session resume. So this provider config no longer contributes the
 * mount; container-runner does.
 *
 * What remains here: env passthrough for codex's runtime knobs.
 *   OPENAI_API_KEY  — fallback auth when auth.json isn't a subscription token
 *   CODEX_MODEL     — model override if the user wants something other than the default
 *   OPENAI_BASE_URL — rare, but supports API-compatible alternates
 */
import { registerProviderContainerConfig } from './provider-container-registry.js';

registerProviderContainerConfig('codex', (ctx) => {
  const env: Record<string, string> = {};
  for (const key of ['OPENAI_API_KEY', 'CODEX_MODEL', 'OPENAI_BASE_URL'] as const) {
    const value = ctx.hostEnv[key];
    if (value) env[key] = value;
  }

  return { mounts: [], env };
});
