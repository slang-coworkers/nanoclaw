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
import '../provider-contracts/index.js';
import { listProviderHostContractNames } from '../provider-contracts/registry.js';
import {
  getProviderContainerConfig,
  listProviderContainerConfigNames,
  providerProvidesAgentSurfaces,
} from './provider-container-registry.js';

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

  // Merge guard on the PRODUCTION registries, not on a fixture. This fork owns
  // the agent surfaces — the coworker_type-scoped skills/ and agents/ mirrors —
  // for every provider that ships, so no shipped provider may declare that it
  // provides its own. A provider declaring ownership would route surface
  // realization through its contract instead, silently replacing those mirrors,
  // and the fork's own coverage cannot see that because its fixtures declare
  // ownership deliberately.
  //
  // Turning this red is the intended cost of declaring surface ownership: it
  // means the fork's mirrors must be reproduced by that provider's contract
  // first. Declaring a host contract is NOT declaring surface ownership; claude
  // declares one and is asserted below to own no surfaces.
  it('no shipped provider claims the agent surfaces', () => {
    const registered = [...new Set([...listProviderContainerConfigNames(), ...listProviderHostContractNames()])].sort();
    expect(registered).toContain('claude');
    const claimants = registered.filter((name) => providerProvidesAgentSurfaces(name));
    expect(claimants).toEqual([]);
  });
});
