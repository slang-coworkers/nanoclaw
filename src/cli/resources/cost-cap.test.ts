/**
 * `cost-cap` CLI resource — the elevated-only scope gate, plus `set` input
 * validation.
 *
 * The gate is enforced by the shared CLI guard (src/cli/guard.ts): `cost-cap`
 * is deliberately NOT in GROUP_SCOPE_RESOURCES, so a container under
 * `cli_scope: 'group'` or `'disabled'` is denied, while the host operator and a
 * `cli_scope: 'global'` orchestrator are allowed. We assert that decision
 * directly against the registered command guard, mocking only the cli_scope
 * lookup (as dispatch.test.ts does).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../log.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockGetContainerConfig = vi.fn();
vi.mock('../../db/container-configs.js', () => ({
  getContainerConfig: (...a: unknown[]) => mockGetContainerConfig(...a),
}));

// guard.ts imports getPendingApproval for the grant path (unused here — these
// are open commands invoked with no grant). getSession keeps parity with the
// real module's surface.
vi.mock('../../db/sessions.js', () => ({
  getPendingApproval: vi.fn(),
  getSession: vi.fn(),
}));

import './cost-cap.js'; // side-effect: registers cost-cap-{get,set,clear}
import { commandGuard, lookup } from '../registry.js';
import { guard, type GuardActor } from '../../guard/index.js';
import type { CallerContext } from '../frame.js';

const AGENT: GuardActor = { kind: 'agent', agentGroupId: 'ag-orchestrator', sessionId: 's' };
const COMMANDS = ['cost-cap-set', 'cost-cap-get', 'cost-cap-clear'] as const;

describe('cost-cap scope gate (elevated only)', () => {
  beforeEach(() => mockGetContainerConfig.mockReset());

  for (const cmd of COMMANDS) {
    it(`${cmd}: the host operator is allowed`, async () => {
      expect((await guard(commandGuard(cmd), { actor: { kind: 'host' }, payload: {} })).effect).toBe('allow');
    });

    it(`${cmd}: a cli_scope=global agent is allowed`, async () => {
      mockGetContainerConfig.mockResolvedValue({ cli_scope: 'global' });
      expect((await guard(commandGuard(cmd), { actor: AGENT, payload: {} })).effect).toBe('allow');
    });

    it(`${cmd}: a cli_scope=group agent is denied`, async () => {
      mockGetContainerConfig.mockResolvedValue({ cli_scope: 'group' });
      expect((await guard(commandGuard(cmd), { actor: AGENT, payload: {} })).effect).toBe('deny');
    });

    it(`${cmd}: a cli_scope=disabled agent is denied`, async () => {
      mockGetContainerConfig.mockResolvedValue({ cli_scope: 'disabled' });
      expect((await guard(commandGuard(cmd), { actor: AGENT, payload: {} })).effect).toBe('deny');
    });

    it(`${cmd}: an agent with no config row (defaults to group) is denied`, async () => {
      mockGetContainerConfig.mockResolvedValue(undefined);
      expect((await guard(commandGuard(cmd), { actor: AGENT, payload: {} })).effect).toBe('deny');
    });
  }
});

describe('cost-cap set — input validation (pre-DB)', () => {
  const HOST: CallerContext = { caller: 'host' };
  const run = async (raw: Record<string, unknown>) => {
    const cmd = lookup('cost-cap-set');
    if (!cmd) throw new Error('cost-cap-set not registered');
    return cmd.handler(cmd.parseArgs(raw), HOST);
  };

  it('rejects an invocation with neither --ceiling nor --cap', async () => {
    await expect(run({})).rejects.toThrow(/at least one of --ceiling or --cap/);
  });

  it('rejects --cap without --group (a fleet-wide cap is not supported)', async () => {
    await expect(run({ cap: '60' })).rejects.toThrow(/--cap is a per-group override and requires --group/);
  });

  it('rejects a negative --ceiling', async () => {
    await expect(run({ ceiling: '-5' })).rejects.toThrow(/--ceiling must be a number >= 0/);
  });

  it('rejects an unknown flag', async () => {
    // Strict validation on the declared args rejects stray flags with usage.
    await expect(run({ celing: '150' })).rejects.toThrow(/unknown flag/);
  });
});
