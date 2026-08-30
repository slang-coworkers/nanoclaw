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
 *   OPENAI_API_KEY  — placeholder only; the OneCLI proxy injects the real key
 *                     on the wire by matching the host pattern (the install's
 *                     inference.nvidia.com key), so the raw secret never enters
 *                     the container. Mirrors NVIDIA_API_KEY/GH_TOKEN in
 *                     container-runner.ts.
 *   CODEX_MODEL     — model override if the user wants something other than the default
 *   OPENAI_BASE_URL — points codex at the OpenAI-compatible endpoint (e.g. the
 *                     NVIDIA inference base URL); non-secret, passed through.
 */
import { registerProviderContainerConfig } from './provider-container-registry.js';

registerProviderContainerConfig('codex', (ctx) => {
  // Never thread a real OPENAI_API_KEY from the host .env into the container
  // (anti-pattern #5). codex still needs the var set so it builds an
  // Authorization header; the OneCLI proxy rewrites it with the real key for
  // the matching host, exactly like the NVIDIA/GH stubs.
  const env: Record<string, string> = { OPENAI_API_KEY: 'ROUTED_VIA_ONECLI_PROXY' };
  // Non-secret runtime knobs pass through unchanged.
  for (const key of ['CODEX_MODEL', 'OPENAI_BASE_URL'] as const) {
    const value = ctx.hostEnv[key];
    if (value) env[key] = value;
  }

  return { mounts: [], env };
});
