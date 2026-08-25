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

// `status`'s handler is a thin delegate to session-cost-cap.ts — mocked here so
// the wiring test below doesn't need a real session/outbound.db; the reader's
// own SQLite read/parse logic has its own tests in session-cost-cap.test.ts.
const mockReadSessionCostCapStatus = vi.fn();
vi.mock('../session-cost-cap.js', () => ({
  readSessionCostCapStatus: (...a: unknown[]) => mockReadSessionCostCapStatus(...a),
}));

import './cost-cap.js'; // side-effect: registers cost-cap-{get,set,clear,status}
import { commandGuard, lookup } from '../registry.js';
import { guard, type GuardActor } from '../../guard/index.js';
import type { CallerContext } from '../frame.js';

const AGENT: GuardActor = { kind: 'agent', agentGroupId: 'ag-orchestrator', sessionId: 's' };
const COMMANDS = ['cost-cap-set', 'cost-cap-get', 'cost-cap-clear', 'cost-cap-status'] as const;

describe('cost-cap scope gate (elevated only)', () => {
  beforeEach(() => mockGetContainerConfig.mockReset());

  for (const cmd of COMMANDS) {
    it(`${cmd}: the host operator is allowed`, () => {
      expect(guard(commandGuard(cmd), { actor: { kind: 'host' }, payload: {} }).effect).toBe('allow');
    });

    it(`${cmd}: a cli_scope=global agent is allowed`, () => {
      mockGetContainerConfig.mockReturnValue({ cli_scope: 'global' });
      expect(guard(commandGuard(cmd), { actor: AGENT, payload: {} }).effect).toBe('allow');
    });

    it(`${cmd}: a cli_scope=group agent is denied`, () => {
      mockGetContainerConfig.mockReturnValue({ cli_scope: 'group' });
      expect(guard(commandGuard(cmd), { actor: AGENT, payload: {} }).effect).toBe('deny');
    });

    it(`${cmd}: a cli_scope=disabled agent is denied`, () => {
      mockGetContainerConfig.mockReturnValue({ cli_scope: 'disabled' });
      expect(guard(commandGuard(cmd), { actor: AGENT, payload: {} }).effect).toBe('deny');
    });

    it(`${cmd}: an agent with no config row (defaults to group) is denied`, () => {
      mockGetContainerConfig.mockReturnValue(undefined);
      expect(guard(commandGuard(cmd), { actor: AGENT, payload: {} }).effect).toBe('deny');
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

describe('cost-cap status', () => {
  const HOST: CallerContext = { caller: 'host' };
  const run = async (raw: Record<string, unknown>) => {
    const cmd = lookup('cost-cap-status');
    if (!cmd) throw new Error('cost-cap-status not registered');
    return cmd.handler(cmd.parseArgs(raw), HOST);
  };

  beforeEach(() => mockReadSessionCostCapStatus.mockReset());

  it('requires --session', () => {
    const cmd = lookup('cost-cap-status');
    if (!cmd) throw new Error('cost-cap-status not registered');
    expect(() => cmd.parseArgs({})).toThrow(/--session is required/);
  });

  it('rejects an unknown flag', () => {
    const cmd = lookup('cost-cap-status');
    if (!cmd) throw new Error('cost-cap-status not registered');
    expect(() => cmd.parseArgs({ session: 's1', bogus: 'x' })).toThrow(/unknown flag/);
  });

  it('delegates to readSessionCostCapStatus with the given session id and returns its result verbatim', async () => {
    mockReadSessionCostCapStatus.mockReturnValue({
      session_id: 's1',
      agent_group_id: 'ag-1',
      status: 'stopped',
      cap_usd: 10,
      spent_usd: 10.2,
    });
    const result = await run({ session: 's1' });
    expect(mockReadSessionCostCapStatus).toHaveBeenCalledWith('s1');
    expect(result).toEqual({
      session_id: 's1',
      agent_group_id: 'ag-1',
      status: 'stopped',
      cap_usd: 10,
      spent_usd: 10.2,
    });
  });
});
