/**
 * Host-side container config for the `pi` provider.
 *
 * pi stores its settings, MCP config and session transcripts under its config
 * dir (`~/.pi/agent`). We pin that under a per-session host directory mounted
 * at /home/node/.pi so the JSONL transcript survives container restarts and the
 * stored `sessionFile` path stays a valid resume token.
 *
 * pi does NOT honor ANTHROPIC_BASE_URL / OPENAI_BASE_URL — it routes outbound
 * requests through HTTPS_PROXY (injected by the OneCLI gateway, same as the
 * claude provider). We only supply stub API keys so pi selects a built-in
 * provider without an interactive `/login`; the real credential is injected at
 * the proxy and the stub value is never used. PI_MODEL / PI_PROVIDER /
 * PI_THINKING_LEVEL are forwarded by the container-runner passthrough list.
 */
import fs from 'fs';
import path from 'path';

import { registerProviderContainerConfig } from './provider-container-registry.js';

registerProviderContainerConfig('pi', (ctx) => {
  const piHome = path.join(ctx.sessionDir, 'pi-home');
  fs.mkdirSync(piHome, { recursive: true });

  const env: Record<string, string> = {
    PI_CODING_AGENT_DIR: '/home/node/.pi/agent',
    // Image is authoritative; skip pi.dev version pings on startup.
    PI_SKIP_VERSION_CHECK: '1',
    // Stub keys — the OneCLI HTTPS_PROXY injects the real credential per request.
    ANTHROPIC_API_KEY: ctx.hostEnv.ANTHROPIC_API_KEY || 'sk-ant-onecli-placeholder',
    OPENAI_API_KEY: ctx.hostEnv.OPENAI_API_KEY || 'sk-onecli-placeholder',
  };

  return {
    mounts: [{ hostPath: piHome, containerPath: '/home/node/.pi', readonly: false }],
    env,
  };
});
