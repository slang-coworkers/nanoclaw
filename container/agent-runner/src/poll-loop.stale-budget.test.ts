// A live ceiling change must reach an open Claude query.
//
// lego perfhound 2026-10-01: a query opened under a $50 ceiling with $37.69 spent
// got maxBudgetUsd $12.31. The ceiling was raised to $220 and then $720, but the
// loop kept pushing follow-ups into that query; once it had spent $12.31 the SDK
// stopped it and every later message failed at once with no tokens, until a
// container restart. The fix: once the query's budget is stale (a control moved
// the headroom) or spent (a max-budget stop), the poller claims nothing more and
// ends the query when nothing is in flight; the next query gets a fresh budget.
// Follow-up acknowledgement is unchanged (acked at push).
import { describe, it, expect, beforeEach, afterEach, setSystemTime } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { initTestSessionDb, closeSessionDb, getInboundDb, getOutboundDb } from './mailbox/sqlite/connection.js';
import { getPendingMessages, type MessageInRow } from './db/messages-in.js';
import { getUndeliveredMessages } from './db/messages-out.js';
import { processQuery, __costCapTestHooks as costHooks } from './poll-loop.js';
import { __setConfigForTest } from './config.js';
import type { AgentQuery, ProviderEvent } from './providers/types.js';

// Plain-text results on an agent route auto-deliver, so no turn is nudged and the
// queue drains exactly as scripted.
const ROUTE = { platformId: 'ag-peer', channelType: 'agent', threadId: 'thr-1', inReplyTo: 'm1' };
const POLL_MS = 20;

let savedState: ReturnType<typeof costHooks.getState>;
let savedCodexHome: string | undefined;
let codexHome: string;

beforeEach(() => {
  initTestSessionDb();
  // Hermetic: the turn-boundary codex fold must never scan real rollout files.
  savedCodexHome = process.env.CODEX_HOME;
  codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-budget-codex-'));
  process.env.CODEX_HOME = codexHome;
  savedState = costHooks.getState();
  __setConfigForTest({
    provider: 'claude',
    assistantName: 'test',
    groupName: 'test',
    agentGroupId: 'ag-test',
    maxMessagesPerPrompt: 10,
    mcpServers: {},
    model: 'claude-opus-4-8',
  } as Parameters<typeof __setConfigForTest>[0]);
  costHooks.setState({
    costEnabled: true,
    costImmortal: false,
    costWindow: 'lifetime',
    costCapUsd: 10,
    costSpentUsd: 37.69,
    costCeilingUsd: 50,
    costCeilingHardStop: false,
    costCeilingEscalated: false,
    costStopRequested: false,
    costBudgetGen: 0,
  });
});

afterEach(() => {
  // Restore every settable field, not just the ones this file touched.
  const { seenMessageIdCount: _count, ...rest } = savedState;
  costHooks.setState(rest);
  costHooks.clearActiveQueryBudget();
  __setConfigForTest(null);
  if (savedCodexHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = savedCodexHome;
  fs.rmSync(codexHome, { recursive: true, force: true });
  closeSessionDb();
});

function insertFollowUp(id: string, text: string, route: { platformId: string; channelType: string } = ROUTE): void {
  getInboundDb()
    .prepare(
      `INSERT INTO messages_in (id, kind, timestamp, status, trigger, on_wake, platform_id, channel_type, thread_id, content)
       VALUES (?, 'chat', datetime('now'), 'pending', 1, 0, ?, ?, 'thr-1', ?)`,
    )
    .run(id, route.platformId, route.channelType, JSON.stringify({ sender: 'peer', text }));
}

function setCeilingContent(toUsd: number, id: string): string {
  const st = costHooks.getState();
  return JSON.stringify({
    protocolVersion: 2,
    operation: 'set_ceiling',
    adjustmentId: id,
    expectedEpochKey: String(st.costBudgetGen),
    expectedCeilingCents: Math.round(st.costCeilingUsd * 100),
    targetCeilingCents: Math.round(toUsd * 100),
  });
}

/** A live set_ceiling control applied directly, the way the poller applies it. */
function setCeiling(toUsd: number, id = `cca-${toUsd}`): void {
  costHooks.applyCostOverride({
    id: `in-${id}`,
    kind: 'cost_override',
    content: setCeilingContent(toUsd, id),
  } as unknown as MessageInRow);
  expect(costHooks.getState().costCeilingUsd).toBeCloseTo(toUsd, 2);
}

/** The same control arriving as an inbound row, so the follow-up poller applies it mid-query. */
function insertSetCeiling(toUsd: number, id = `cca-row-${toUsd}`): void {
  getInboundDb()
    .prepare(
      `INSERT INTO messages_in (id, kind, timestamp, status, trigger, on_wake, platform_id, channel_type, content)
       VALUES (?, 'cost_override', datetime('now'), 'pending', 1, 0, 'dashboard:admin', 'dashboard', ?)`,
    )
    .run(`in-${id}`, setCeilingContent(toUsd, id));
}

function controllableQuery(script: (q: { pushes: string[]; ended: () => boolean }) => AsyncGenerator<ProviderEvent>) {
  const pushes: string[] = [];
  let endCalls = 0;
  let abortCalls = 0;
  const query: AgentQuery = {
    push: (m: string) => {
      pushes.push(m);
    },
    end: () => {
      endCalls += 1;
    },
    events: script({ pushes, ended: () => endCalls + abortCalls > 0 }),
    abort: () => {
      abortCalls += 1;
    },
  };
  return { query, pushes, endCalls: () => endCalls, abortCalls: () => abortCalls };
}

async function until(cond: () => boolean, ms = 4000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!cond() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isPending = (id: string) => getPendingMessages().some((m) => m.id === id);
const ackOf = (id: string) =>
  (
    getOutboundDb().prepare('SELECT status FROM processing_ack WHERE message_id = ?').get(id) as
      | { status: string }
      | undefined
  )?.status;
const outboundTexts = () => getUndeliveredMessages().map((m) => String(JSON.parse(m.content).text ?? ''));
const run = (q: AgentQuery, route: typeof ROUTE | typeof CHAT = ROUTE) =>
  processQuery(q, route, ['m1'], 'claude', undefined, 'prompt', undefined, false, undefined, POLL_MS);
// Error results on a chat route are delivered as failure notices (on an agent
// route the runner bounces them back for host redrive instead).
const CHAT = { platformId: 'chan-1', channelType: 'discord', threadId: 'thr-1', inReplyTo: 'm1' };
const maxBudgetStop: ProviderEvent = {
  type: 'result',
  text: null,
  isError: true,
  error: 'Reached maximum budget ($12.31)',
  maxBudgetExceeded: true,
};

describe('budget basis (unit)', () => {
  it('records the start budget; spend accrual alone never makes it stale', () => {
    expect(costHooks.startQueryBudget()).toBeCloseTo(12.31, 2);
    expect(costHooks.staleQueryBudget()).toBeNull();
    costHooks.setState({ costSpentUsd: 45 });
    expect(costHooks.staleQueryBudget()).toBeNull();
  });

  it('a raise latches it stale, and the latch survives later spend', () => {
    costHooks.setState({ costSpentUsd: 40 }); // $10 budget
    costHooks.startQueryBudget();
    costHooks.setState({ costSpentUsd: 46 }); // the query spent $6 of it
    setCeiling(55); // headroom $9 < the $10 start budget, but the query has only $4 left
    expect(costHooks.staleQueryBudget()).not.toBeNull();
    costHooks.setState({ costSpentUsd: 50 });
    expect(costHooks.staleQueryBudget()).not.toBeNull();
  });

  it('a lowered ceiling is stale too (the open query would overshoot the new ceiling)', () => {
    costHooks.startQueryBudget();
    setCeiling(45);
    expect(costHooks.staleQueryBudget()).not.toBeNull();
  });

  it('a reconcile that lowers spend is stale', () => {
    costHooks.setState({ costSpentUsd: 40 });
    costHooks.startQueryBudget();
    costHooks.setState({ costSpentUsd: 47 });
    const st = costHooks.getState();
    costHooks.applyCostOverride({
      id: 'in-csr-1',
      kind: 'cost_override',
      content: JSON.stringify({
        protocolVersion: 2,
        operation: 'reconcile',
        adjustmentId: 'csr-1',
        expectedEpochKey: String(st.costBudgetGen),
        expectedCeilingCents: Math.round(st.costCeilingUsd * 100),
        expectedSpentCents: Math.round(st.costSpentUsd * 100),
        targetSpentCents: 4300,
      }),
    } as unknown as MessageInRow);
    expect(costHooks.getState().costSpentUsd).toBeCloseTo(43, 2);
    expect(costHooks.staleQueryBudget()).not.toBeNull();
  });

  it('a rejected control (wrong epoch) leaves it fresh', () => {
    costHooks.startQueryBudget();
    costHooks.applyCostOverride({
      id: 'in-cca-bad',
      kind: 'cost_override',
      content: JSON.stringify({
        protocolVersion: 2,
        operation: 'set_ceiling',
        adjustmentId: 'cca-bad',
        expectedEpochKey: '99',
        expectedCeilingCents: 5000,
        targetCeilingCents: 72000,
      }),
    } as unknown as MessageInRow);
    expect(costHooks.getState().costCeilingUsd).toBeCloseTo(50, 2);
    expect(costHooks.staleQueryBudget()).toBeNull();
  });

  it('the next query starts a fresh basis from the live ceiling', () => {
    costHooks.startQueryBudget();
    setCeiling(720);
    expect(costHooks.staleQueryBudget()).not.toBeNull();
    expect(costHooks.startQueryBudget()).toBeCloseTo(682.31, 2);
    expect(costHooks.staleQueryBudget()).toBeNull();
  });

  it('no ceiling, immortal, or cost off: no budget and never stale', () => {
    for (const p of [{ costEnabled: false }, { costImmortal: true }, { costCeilingUsd: 0 }]) {
      costHooks.setState({ costEnabled: true, costImmortal: false, costCeilingUsd: 50, ...p });
      expect(costHooks.startQueryBudget()).toBeUndefined();
      costHooks.setState({ costSpentUsd: 1 }); // accrual
      expect(costHooks.staleQueryBudget()).toBeNull();
    }
  });
});

describe('open query after a ceiling change', () => {
  it('lego incident: after a raise mid-query, the next follow-up is not pushed, stays pending, and the query ends', async () => {
    costHooks.startQueryBudget(); // $12.31
    const q = controllableQuery(async function* ({ ended }) {
      yield { type: 'init', continuation: 'sess-1' };
      yield { type: 'result', text: 'first answer' };
      insertSetCeiling(720); // applied by the follow-up poller, like the dashboard raise
      await until(() => costHooks.getState().costCeilingUsd > 700);
      insertFollowUp('m2', 'follow-up after the raise');
      await until(() => ended());
    });

    await run(q.query);

    expect(q.endCalls()).toBe(1);
    expect(q.abortCalls()).toBe(0);
    expect(q.pushes.some((p) => p.includes('follow-up after the raise'))).toBe(false);
    expect(isPending('m2')).toBe(true);
    expect(ackOf('m2')).toBeUndefined();
    // The next query is created from the live ceiling.
    expect(costHooks.startQueryBudget()).toBeCloseTo(682.31, 2);
  }, 20_000);

  it('a lowered ceiling ends the query the same way, and the next budget is the smaller one', async () => {
    costHooks.startQueryBudget();
    const q = controllableQuery(async function* ({ ended }) {
      yield { type: 'init', continuation: 'sess-1' };
      yield { type: 'result', text: 'first answer' };
      setCeiling(45);
      insertFollowUp('m2', 'after the lowering');
      await until(() => ended());
    });

    await run(q.query);

    expect(q.endCalls()).toBe(1);
    expect(q.pushes.some((p) => p.includes('after the lowering'))).toBe(false);
    expect(isPending('m2')).toBe(true);
    expect(costHooks.startQueryBudget()).toBeCloseTo(7.31, 2);
  }, 20_000);

  it('never ends a query that is still working: the follow-up waits until the turn completes', async () => {
    costHooks.startQueryBudget();
    let endedMidTurn = -1;
    let pushedMidTurn = true;
    const q = controllableQuery(async function* ({ pushes, ended }) {
      yield { type: 'init', continuation: 'sess-1' };
      setCeiling(720); // raised while turn 1 is running
      insertFollowUp('m2', 'arrives mid-turn');
      await sleep(15 * POLL_MS); // many poller ticks
      endedMidTurn = ended() ? 1 : 0;
      pushedMidTurn = pushes.some((p) => p.includes('arrives mid-turn'));
      yield { type: 'result', text: 'turn one done' };
      await until(() => ended());
    });

    await run(q.query);

    expect(endedMidTurn).toBe(0);
    expect(pushedMidTurn).toBe(false);
    expect(q.endCalls()).toBe(1);
    expect(q.abortCalls()).toBe(0);
    expect(outboundTexts()).toContain('turn one done');
    expect(isPending('m2')).toBe(true);
  }, 20_000);

  it('a follow-up pushed BEFORE the raise still gets its own answer, acked at push as before; the next one waits', async () => {
    costHooks.startQueryBudget();
    let ackAtPush: string | undefined;
    const q = controllableQuery(async function* ({ pushes, ended }) {
      yield { type: 'init', continuation: 'sess-1' };
      insertFollowUp('m2', 'queued before the raise');
      await until(() => pushes.some((p) => p.includes('queued before the raise')));
      ackAtPush = ackOf('m2');
      setCeiling(720);
      insertFollowUp('m3', 'after the raise');
      await sleep(10 * POLL_MS);
      yield { type: 'result', text: 'turn one done' };
      yield { type: 'result', text: 'answer to m2' };
      await until(() => ended());
    });

    await run(q.query);

    expect(ackAtPush).toBe('completed'); // unchanged: follow-ups are acked when pushed
    expect(outboundTexts()).toEqual(expect.arrayContaining(['turn one done', 'answer to m2']));
    expect(q.pushes.some((p) => p.includes('after the raise'))).toBe(false);
    expect(isPending('m3')).toBe(true);
    expect(q.endCalls()).toBe(1);
    expect(q.abortCalls()).toBe(0);
  }, 20_000);

  it('spend accrual alone changes nothing: follow-ups are still pushed into the open query', async () => {
    costHooks.startQueryBudget();
    const q = controllableQuery(async function* ({ pushes }) {
      yield { type: 'init', continuation: 'sess-1' };
      costHooks.setState({ costSpentUsd: 45 });
      yield { type: 'result', text: 'first answer' };
      insertFollowUp('m2', 'ordinary follow-up');
      await until(() => pushes.some((p) => p.includes('ordinary follow-up')));
      yield { type: 'result', text: 'second answer' };
    });

    await run(q.query);

    expect(q.pushes.some((p) => p.includes('ordinary follow-up'))).toBe(true);
    expect(ackOf('m2')).toBe('completed');
    expect(q.endCalls()).toBe(0);
    expect(q.abortCalls()).toBe(0);
  }, 20_000);
});

describe('open query after an SDK max-budget stop', () => {
  it('pushes nothing more; an already-queued follow-up still gets its own notice; the query ends after the drain', async () => {
    costHooks.startQueryBudget();
    const q = controllableQuery(async function* ({ pushes, ended }) {
      yield { type: 'init', continuation: 'sess-1' };
      insertFollowUp('m2', 'queued before the stop', CHAT);
      await until(() => pushes.some((p) => p.includes('queued before the stop')));
      yield maxBudgetStop; // m1's turn
      insertFollowUp('m3', 'after the stop', CHAT);
      await sleep(10 * POLL_MS);
      yield maxBudgetStop; // m2's turn fails at once, as the SDK does
      await until(() => ended());
    });

    await run(q.query, CHAT);

    expect(ackOf('m2')).toBe('completed'); // unchanged ack-at-push
    const notices = outboundTexts().filter((t) => /maximum budget/i.test(t));
    expect(notices.length).toBe(2); // one per turn, as before
    expect(q.pushes.some((p) => p.includes('after the stop'))).toBe(false);
    expect(isPending('m3')).toBe(true);
    expect(q.endCalls()).toBe(1);
    expect(q.abortCalls()).toBe(0);
  }, 20_000);

  it('a stop with no ceiling change still ends the query before the next message', async () => {
    costHooks.startQueryBudget();
    const q = controllableQuery(async function* ({ ended }) {
      yield { type: 'init', continuation: 'sess-1' };
      yield maxBudgetStop;
      insertFollowUp('m2', 'after a real stop', CHAT);
      await until(() => ended());
    });

    await run(q.query, CHAT);

    expect(q.pushes.some((p) => p.includes('after a real stop'))).toBe(false);
    expect(isPending('m2')).toBe(true);
    expect(q.endCalls()).toBe(1);
  }, 20_000);
  it('an ordinary error that merely mentions the phrase does not retire the query', async () => {
    costHooks.startQueryBudget();
    const q = controllableQuery(async function* ({ pushes }) {
      yield { type: 'init', continuation: 'sess-1' };
      // No structured flag: e.g. a tool error quoting someone else's budget message.
      yield { type: 'result', text: null, isError: true, error: 'tool said: Reached maximum budget ($1.00)' };
      insertFollowUp('m2', 'after an unrelated error', CHAT);
      await until(() => pushes.some((p) => p.includes('after an unrelated error')));
      yield { type: 'result', text: null, isError: true, error: 'second error' };
    });

    await run(q.query, CHAT);

    expect(q.pushes.some((p) => p.includes('after an unrelated error'))).toBe(true);
    expect(q.endCalls()).toBe(0);
  }, 20_000);
});

describe('an unanswered correction is never cut short', () => {
  let savedGateState: string | undefined;
  beforeEach(() => {
    savedGateState = process.env.ROUTING_GATE_STATE_PATH;
    process.env.ROUTING_GATE_STATE_PATH = path.join(codexHome, 'workflow-state.json');
    getInboundDb()
      .prepare(
        `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
         VALUES ('peer', 'peer', 'agent', NULL, NULL, 'ag-peer')`,
      )
      .run();
  });
  afterEach(() => {
    setSystemTime();
    if (savedGateState === undefined) delete process.env.ROUTING_GATE_STATE_PATH;
    else process.env.ROUTING_GATE_STATE_PATH = savedGateState;
  });

  it('a mid-turn gate correction keeps a stale query open past the fresh-session quiet period', async () => {
    costHooks.startQueryBudget();
    let endedAfterQuietClock: boolean | undefined;
    const q = controllableQuery(async function* ({ pushes, ended }) {
      yield { type: 'init', continuation: 'sess-1' };
      setCeiling(720);
      insertFollowUp('m2', 'waits for the correction');
      // One block delivers; the marked one without in_reply_to is refused and its
      // correction is pushed straight into the query (not a queued turn).
      yield {
        type: 'text',
        text: '<message to="peer">ok</message><message to="peer">[Resolution] done</message>',
      };
      await until(() => pushes.some((p) => p.includes('chain-routing-gate')));
      yield { type: 'result', text: null };
      // The correction's tool call is silent for 6 minutes: past the 5-minute
      // fresh-session quiet period, under the 20-minute idle end.
      setSystemTime(new Date(Date.now() + 6 * 60_000));
      await sleep(15 * POLL_MS);
      endedAfterQuietClock = ended();
      setSystemTime();
      yield { type: 'text', text: '<message to="peer" in_reply_to="m1">[Resolution] done</message>' };
      yield { type: 'result', text: null };
      await until(() => ended());
    });

    await processQuery(q.query, ROUTE, ['m1'], 'claude', undefined, 'prompt', undefined, true, undefined, POLL_MS);

    expect(endedAfterQuietClock).toBe(false);
    expect(outboundTexts().filter((t) => t === '[Resolution] done')).toHaveLength(1);
    expect(q.pushes.some((p) => p.includes('waits for the correction'))).toBe(false);
    expect(isPending('m2')).toBe(true);
    expect(q.endCalls()).toBe(1);
    expect(q.abortCalls()).toBe(0);
  }, 20_000);
});

describe('no ceiling: identical to before', () => {
  it('cost tracking off: follow-ups are pushed and acked at push; the query is never ended for budget', async () => {
    costHooks.setState({ costEnabled: false });
    costHooks.startQueryBudget();
    const q = controllableQuery(async function* ({ pushes }) {
      yield { type: 'init', continuation: 'sess-1' };
      yield { type: 'result', text: 'first answer' };
      insertFollowUp('m2', 'follow-up, no ceiling');
      await until(() => pushes.some((p) => p.includes('follow-up, no ceiling')));
      yield { type: 'result', text: 'second answer' };
    });

    await run(q.query);

    expect(q.pushes.some((p) => p.includes('follow-up, no ceiling'))).toBe(true);
    expect(ackOf('m2')).toBe('completed');
    expect(q.endCalls()).toBe(0);
    expect(q.abortCalls()).toBe(0);
  }, 20_000);

  it('immortal session: same', async () => {
    costHooks.setState({ costImmortal: true });
    costHooks.startQueryBudget();
    const q = controllableQuery(async function* ({ pushes }) {
      yield { type: 'init', continuation: 'sess-1' };
      yield { type: 'result', text: 'first answer' };
      insertFollowUp('m2', 'immortal follow-up');
      await until(() => pushes.some((p) => p.includes('immortal follow-up')));
      yield { type: 'result', text: 'second answer' };
    });

    await run(q.query);

    expect(q.pushes.some((p) => p.includes('immortal follow-up'))).toBe(true);
    expect(q.endCalls()).toBe(0);
  }, 20_000);
});
