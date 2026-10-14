// End to end through runPollLoop: after a ceiling change (or the SDK's max-budget
// stop) the open query is ended at a quiet boundary, the follow-up that arrived
// meanwhile is NOT run in it, and the outer loop starts a second query whose
// maxBudgetUsd comes from the live ceiling and which picks the follow-up up
// exactly once. See poll-loop.stale-budget.test.ts for the processQuery-level cases.
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { closeSessionDb, getInboundDb, getOutboundDb, initTestSessionDb } from './mailbox/sqlite/connection.js';
import { getUndeliveredMessages } from './db/messages-out.js';
import { setCostCap } from './db/session-state.js';
import { __setConfigForTest, type RunnerConfig } from './config.js';
import { __costCapTestHooks as H, runPollLoop } from './poll-loop.js';
import type { AgentProvider, AgentQuery, ProviderEvent, QueryInput } from './providers/types.js';

type Script = (q: { ended: () => boolean; pushes: string[] }) => AsyncGenerator<ProviderEvent>;

/** A provider whose Nth query runs scripts[N], recording each query's input and pushes. */
class ScriptedProvider implements AgentProvider {
  inputs: QueryInput[] = [];
  pushes: string[][] = [];
  constructor(private scripts: Script[]) {}
  registerMemorySessionHook(): boolean {
    return false;
  }
  isSessionInvalid(): boolean {
    return false;
  }
  query(input: QueryInput): AgentQuery {
    const n = this.inputs.length;
    this.inputs.push(input);
    const pushes: string[] = [];
    this.pushes.push(pushes);
    let closed = false;
    const ended = () => closed;
    const script =
      this.scripts[n] ??
      async function* (): AsyncGenerator<ProviderEvent> {
        throw new Error(`unexpected query #${n + 1}`);
      };
    return {
      push: (m: string) => {
        pushes.push(m);
      },
      end: () => {
        closed = true;
      },
      abort: () => {
        closed = true;
      },
      events: script({ ended, pushes }),
    };
  }
}

function cfg(): RunnerConfig {
  return {
    provider: 'claude',
    assistantName: 'test',
    groupName: 'test',
    agentGroupId: 'ag-test',
    maxMessagesPerPrompt: 10,
    mcpServers: {},
    model: 'claude-opus-4-8',
    costCapT2Usd: 10,
    costCeilingT2Usd: 50,
  } as RunnerConfig;
}

let savedState: ReturnType<typeof H.getState>;
let savedCodexHome: string | undefined;
let codexHome: string;

beforeEach(() => {
  initTestSessionDb();
  savedCodexHome = process.env.CODEX_HOME;
  codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-budget-loop-codex-'));
  process.env.CODEX_HOME = codexHome; // the poll-boundary codex fold scans an empty dir
  savedState = H.getState();
  __setConfigForTest(cfg());
  setCostCap({
    capUsd: 10,
    spentUsd: 37.69,
    status: 'escalated',
    immortal: false,
    window: 'lifetime',
    ceilingUsd: 50,
    budgetGen: 0,
  });
  getInboundDb()
    .prepare(
      `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
       VALUES ('discord-test', 'Discord Test', 'channel', 'discord', 'chan-1', NULL)`,
    )
    .run();
});

afterEach(() => {
  const { seenMessageIdCount: _count, ...rest } = savedState;
  H.setState(rest);
  H.clearActiveQueryBudget();
  __setConfigForTest(null);
  if (savedCodexHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = savedCodexHome;
  fs.rmSync(codexHome, { recursive: true, force: true });
  closeSessionDb();
});

function insertChat(id: string, text: string, route: { platformId: string; channelType: string }): void {
  getInboundDb()
    .prepare(
      `INSERT INTO messages_in (id, kind, timestamp, status, platform_id, channel_type, content)
       VALUES (?, 'chat', datetime('now'), 'pending', ?, ?, ?)`,
    )
    .run(id, route.platformId, route.channelType, JSON.stringify({ sender: 'Alice', text }));
}
const DISCORD = { platformId: 'chan-1', channelType: 'discord' };
const AGENT = { platformId: 'ag-peer', channelType: 'agent' };

function insertSetCeiling(targetCents: number): void {
  getInboundDb()
    .prepare(
      `INSERT INTO messages_in (id, kind, timestamp, status, content) VALUES (?, 'cost_override', datetime('now'), 'pending', ?)`,
    )
    .run(
      `in-cca-${targetCents}`,
      JSON.stringify({
        protocolVersion: 2,
        operation: 'set_ceiling',
        adjustmentId: `cca-${targetCents}`,
        expectedEpochKey: '0',
        expectedCeilingCents: 5000,
        targetCeilingCents: targetCents,
      }),
    );
}

async function waitFor(cond: () => boolean, ms = 6000, what = 'condition'): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error(`waitFor timeout: ${what}`);
    await new Promise((r) => setTimeout(r, 15));
  }
}
const outTexts = () => getUndeliveredMessages().map((m) => String(JSON.parse(m.content).text ?? ''));
const ackOf = (id: string) =>
  (
    getOutboundDb().prepare('SELECT status FROM processing_ack WHERE message_id = ?').get(id) as
      | { status: string }
      | undefined
  )?.status;

/** Hold the query open until the loop ends it (or the test aborts the loop). */
async function* holdOpen(ended: () => boolean): AsyncGenerator<ProviderEvent> {
  while (!ended()) await new Promise((r) => setTimeout(r, 10));
}

async function runLoop(provider: ScriptedProvider, body: () => Promise<void>): Promise<void> {
  const controller = new AbortController();
  const loop = runPollLoop({
    provider,
    providerName: 'claude',
    cwd: '/tmp',
    signal: controller.signal,
    activePollIntervalMs: 10,
  });
  loop.catch(() => {});
  try {
    await body();
  } finally {
    controller.abort();
    await Promise.race([loop.catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
  }
}

describe('runPollLoop: a ceiling change reaches the next query', () => {
  for (const [label, targetCents, nextBudget] of [
    ['raise', 72000, 682.31],
    ['lower (still above spend)', 4500, 7.31],
  ] as const) {
    it(`${label}: the follow-up runs only in a fresh query whose budget follows the ceiling`, async () => {
      insertChat('m1', 'first task', DISCORD);
      const provider = new ScriptedProvider([
        async function* ({ ended }) {
          yield { type: 'init', continuation: 'sess-1' };
          yield { type: 'result', text: '<message to="discord-test">reply 1</message>' };
          yield* holdOpen(ended);
        },
        async function* ({ ended }) {
          yield { type: 'init', continuation: 'sess-1' };
          yield { type: 'result', text: '<message to="discord-test">reply 2</message>' };
          yield* holdOpen(ended);
        },
      ]);

      await runLoop(provider, async () => {
        await waitFor(() => outTexts().includes('reply 1'), 6000, 'reply 1');
        insertSetCeiling(targetCents);
        await waitFor(() => Math.abs(H.getState().costCeilingUsd - targetCents / 100) < 1e-6, 6000, 'control applied');
        insertChat('m2', 'second task', DISCORD);
        await waitFor(() => outTexts().includes('reply 2'), 8000, 'reply 2');
      });

      expect(provider.inputs).toHaveLength(2);
      expect(provider.inputs[0].maxBudgetUsd).toBeCloseTo(12.31, 2);
      expect(provider.inputs[1].maxBudgetUsd).toBeCloseTo(nextBudget, 2);
      expect(provider.pushes[0].some((p) => p.includes('second task'))).toBe(false); // never run on the old budget
      expect(provider.inputs[1].prompt).toContain('second task');
      expect(outTexts().filter((t) => t === 'reply 2')).toHaveLength(1);
      expect(ackOf('m2')).toBe('completed');
    }, 30_000);
  }
});

describe("runPollLoop: the SDK's max-budget stop", () => {
  const stop: ProviderEvent = {
    type: 'result',
    text: null,
    isError: true,
    error: 'Reached maximum budget ($12.31)',
    maxBudgetExceeded: true,
  };

  it('chat route: notice for the stopped turn; the follow-up runs in a fresh query', async () => {
    insertChat('m1', 'first task', DISCORD);
    const provider = new ScriptedProvider([
      async function* ({ ended }) {
        yield { type: 'init', continuation: 'sess-1' };
        yield stop;
        yield* holdOpen(ended);
      },
      async function* ({ ended }) {
        yield { type: 'init', continuation: 'sess-1' };
        yield { type: 'result', text: '<message to="discord-test">reply 2</message>' };
        yield* holdOpen(ended);
      },
    ]);

    await runLoop(provider, async () => {
      await waitFor(() => outTexts().some((t) => /maximum budget/i.test(t)), 6000, 'stop notice');
      insertChat('m2', 'second task', DISCORD);
      await waitFor(() => outTexts().includes('reply 2'), 8000, 'reply 2');
    });

    expect(provider.inputs).toHaveLength(2);
    expect(provider.pushes[0].some((p) => p.includes('second task'))).toBe(false);
    expect(provider.inputs[1].prompt).toContain('second task');
    expect(outTexts().filter((t) => /maximum budget/i.test(t))).toHaveLength(1);
    expect(ackOf('m2')).toBe('completed');
  }, 30_000);

  it('agent route: the bounced trigger is left for host redrive, not re-run by the fresh query', async () => {
    insertChat('m1', 'peer task', AGENT);
    const provider = new ScriptedProvider([
      async function* ({ ended }) {
        yield { type: 'init', continuation: 'sess-1' };
        yield stop;
        yield* holdOpen(ended);
      },
      async function* ({ ended }) {
        yield { type: 'init', continuation: 'sess-1' };
        yield { type: 'result', text: '<message to="discord-test">reply 2</message>' };
        yield* holdOpen(ended);
      },
    ]);

    await runLoop(provider, async () => {
      await waitFor(() => (ackOf('m1') ?? '').startsWith('bounced'), 6000, 'm1 bounced');
      insertChat('m2', 'second task', DISCORD);
      await waitFor(() => outTexts().includes('reply 2'), 8000, 'reply 2');
    });

    expect(provider.inputs).toHaveLength(2);
    expect(provider.inputs[1].prompt).toContain('second task');
    expect(provider.inputs[1].prompt).not.toContain('peer task');
    expect((ackOf('m1') ?? '').startsWith('bounced')).toBe(true);
    expect(ackOf('m2')).toBe('completed');
  }, 30_000);
});
