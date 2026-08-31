// Host-side provider container-config barrel.
// Providers that need host-side container setup (extra mounts, env passthrough,
// per-session directories) self-register on import.
//
// Skills add a new provider by appending one import line below.

// claude DOES have a host-side contribution — it forwards ANTHROPIC_BASE_URL from
// .env plus the ANTHROPIC_AUTH_TOKEN proxy stub (providers/claude.ts). The comment
// here used to say claude "has no host needs" and the import was absent, so
// `getProviderContainerConfig('claude')` returned undefined and that env was never
// applied. Docker mode masked it: the container gets a clean env, so inheriting
// nothing was harmless. AGENT_RUNTIME=local inherits the HOST's env instead, so
// the agent silently kept the host's own ANTHROPIC_BASE_URL — a per-session
// sidecar a child process cannot use — and every turn died with a TLS EPROTO.
import './claude.js';
import './codex.js';
import './opencode.js';
import './pi.js';
