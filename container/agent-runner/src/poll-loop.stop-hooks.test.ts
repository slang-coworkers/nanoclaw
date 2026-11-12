import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { closeSessionDb, getInboundDb, initTestSessionDb } from './mailbox/sqlite/connection.js';
import { processQuery } from './poll-loop.js';
import type { StopHookInput, StopHookRunner } from './stop-hooks.js';
import type { AgentQuery, ProviderEvent } from './providers/types.js';

// Fork-owned. For a provider whose harness does not run the Stop hooks, the poll
// loop runs them at each result, and a block continues the same turn the way
// Claude Code feeds a Stop block back to the model.

const CHAT_ROUTING = { platformId: 'chan-1', channelType: 'discord', threadId: null, inReplyTo: 'm1', taskRun: false };

beforeEach(() => {
  initTestSessionDb();
  getInboundDb()
    .prepare(
      `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
       VALUES ('main', 'main', 'channel', 'discord', 'chan-1', NULL)`,
    )
    .run();
});
afterEach(() => {
  closeSessionDb();
});

/** A query whose events are `turns` answered turns, each delivering one wrapped reply. */
function answeredTurns(turns: number, last?: Partial<Extract<ProviderEvent, { type: 'result' }>>) {
  const pushes: string[] = [];
  async function* events(): AsyncGenerator<ProviderEvent> {
    yield { type: 'init', continuation: 'ses_1' };
    for (let i = 1; i <= turns; i++) {
      yield { type: 'text', text: `<message to="main">answer ${i}</message>` };
      yield { type: 'result', text: `<message to="main">answer ${i}</message>`, ...(i === turns ? last : {}) };
    }
  }
  const query: AgentQuery = {
    push: (m: string) => void pushes.push(m),
    end: () => {},
    events: events(),
    abort: () => {},
  };
  return { query, pushes };
}

function recorder(block: (input: StopHookInput) => boolean) {
  const calls: StopHookInput[] = [];
  const run: StopHookRunner = async (input) => {
    calls.push(input);
    return block(input) ? { block: true, reason: 'Explanation comment is stale.' } : { block: false, reason: '' };
  };
  return { calls, run };
}

const run = (query: AgentQuery, stopHooks: StopHookRunner | null) =>
  processQuery(
    query,
    CHAT_ROUTING,
    ['m1'],
    'opencode',
    undefined,
    'prompt',
    undefined,
    true,
    undefined,
    undefined,
    false,
    () => null,
    stopHooks,
  );

const stopPushes = (pushes: string[]) => pushes.filter((p) => p.includes('Stop hook feedback'));

describe('Stop hooks run by the poll loop', () => {
  it('a block continues the turn once, and the continuation stops with stop_hook_active', async () => {
    const { query, pushes } = answeredTurns(2);
    const hooks = recorder((input) => !input.stopHookActive);
    await run(query, hooks.run);
    expect(stopPushes(pushes)).toEqual(['<system>Stop hook feedback:\nExplanation comment is stale.</system>']);
    expect(hooks.calls.map((c) => [c.sessionId, c.stopHookActive, c.failed])).toEqual([
      ['ses_1', false, false],
      ['ses_1', true, false],
    ]);
    expect(hooks.calls[0].lastAssistantMessage).toBe('<message to="main">answer 1</message>');
  });

  it('a hook that ignores stop_hook_active continues the turn at most three times', async () => {
    const { query, pushes } = answeredTurns(4);
    const hooks = recorder(() => true);
    await run(query, hooks.run);
    expect(stopPushes(pushes)).toHaveLength(3);
    expect(hooks.calls).toHaveLength(4);
  });

  it('a failed turn runs the hooks as a failure', async () => {
    const { query } = answeredTurns(1, { isError: true });
    const hooks = recorder(() => false);
    await run(query, hooks.run);
    expect(hooks.calls.map((c) => c.failed)).toEqual([true]);
  });

  it('runs nothing when the provider runs its own Stop hooks (no runner)', async () => {
    const { query, pushes } = answeredTurns(1);
    await run(query, null);
    expect(stopPushes(pushes)).toEqual([]);
  });
});
