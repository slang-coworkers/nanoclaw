import { describe, expect, it } from 'vitest';

// Barrel-driven registration guard for the host provider container-config
// registry. The whole point is that this file imports ONLY the real barrel
// (`./index.js`): the barrel's `import './codex.js'` / `import './opencode.js'`
// lines are the load-bearing wiring. The per-provider *.factory tests import
// the provider module DIRECTLY, which self-registers it and stays green even
// when a barrel line is deleted — the provider trap called out in
// docs/skill-guidelines.md. Vitest isolates modules per test file, so here the
// barrel is the sole registrant: delete or rename a barrel line and the
// assertions below go red.
import './index.js';
import { getProviderContainerConfig, listProviderContainerConfigNames } from './provider-container-registry.js';

describe('host provider container-config barrel', () => {
  it('registers codex + opencode + pi via the barrel (guards the import lines)', () => {
    const names = listProviderContainerConfigNames();
    expect(names).toContain('codex');
    expect(names).toContain('opencode');
    expect(names).toContain('pi');
    expect(typeof getProviderContainerConfig('codex')).toBe('function');
    expect(typeof getProviderContainerConfig('opencode')).toBe('function');
    expect(typeof getProviderContainerConfig('pi')).toBe('function');
  });
});
