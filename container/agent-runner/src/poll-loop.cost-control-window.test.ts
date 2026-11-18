/**
 * A cost-stopped runner must see a human cost decision however many older wake
 * rows are queued ahead of it.
 *
 * A stopped runner takes no turn input, so the rows in its per-prompt window
 * never drain. Consider a session stopped at its $300 ceiling with 16 GitHub
 * events queued and `maxMessagesPerPrompt` 10: the `continue` decisions written
 * after those events are rows 17 to 19. getPendingMessages returns every due
 * control row on top of the capped window (db/messages-in.ts), so the stopped
 * branch of runPollLoop applies the first `continue`, refuses the later
 * duplicates by their epoch, and then resumes on the queued events.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

import { closeSessionDb, getInboundDb, getOutboundDb, initTestSessionDb } from './mailbox/sqlite/connection.js';
import { getUndeliveredMessages } from './db/messages-out.js';
import { setCostCap } from './db/session-state.js';
import { __setConfigForTest } from './config.js';
import { __costCapTestHooks as H, runPollLoop } from './poll-loop.js';
import { MockProvider } from './providers/mock.js';
import type { RunnerConfig } from './config.js';

const CAP = 10;
const BACKLOG = 16;

function cfg(over: Partial<RunnerConfig> = {}): RunnerConfig {
  return {
    provider: 'claude',
    assistantName: 'test',
    groupName: 'test',
    agentGroupId: 'ag-test',
    maxMessagesPerPrompt: CAP,
    mcpServers: {},
    model: 'claude-opus-4-8',
    costCapT2Usd: 180,
    costCeilingT2Usd: 300,
    ...over,
  };
}

function insertChat(id: string, seq: number, text: string): void {
  getInboundDb()
    .prepare(
      `INSERT INTO messages_in (id, seq, kind, timestamp, status, platform_id, channel_type, content)
       VALUES (?, ?, 'chat', datetime('now'), 'pending', 'chan-1', 'discord', ?)`,
    )
    .run(id, seq, JSON.stringify({ sender: 'Alice', text }));
}

function insertControl(id: string, seq: number, content: object): void {
  getInboundDb()
    .prepare(
      `INSERT INTO messages_in (id, seq, kind, timestamp, status, "trigger", content)
       VALUES (?, ?, 'cost_override', datetime('now'), 'pending', 1, ?)`,
    )
    .run(id, seq, JSON.stringify(content));
}

function ackStatus(messageId: string): string | undefined {
  const row = getOutboundDb().prepare('SELECT status FROM processing_ack WHERE message_id = ?').get(messageId) as
    { status: string } | undefined;
  return row?.status;
}

function replied(): boolean {
  return getUndeliveredMessages().some((m) => m.kind === 'chat' && JSON.parse(m.content).text === 'resumed');
}

async function waitFor(condition: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** Seed a session stopped at its ceiling with a full window of older wake rows. */
function seedStoppedWithBacklog(): void {
  setCostCap({
    capUsd: 180,
    spentUsd: 301.34,
    status: 'stopped',
    immortal: false,
    window: 'lifetime',
    ceilingUsd: 300,
    budgetGen: 0,
  });
  getInboundDb()
    .prepare(
      `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
       VALUES ('discord-test', 'Discord Test', 'channel', 'discord', 'chan-1', NULL)`,
    )
    .run();
  for (let i = 1; i <= BACKLOG; i++) insertChat(`event-${i}`, i * 2, `event ${i}`);
}

/** Run the loop until `done` holds, then stop it. */
async function runUntil(done: () => boolean): Promise<void> {
  // providerName 'claude' passes costEnabled's provider gate; reportsTurnAccounting
  // marks the mock as a metered provider, as OpenCode and Claude are.
  const provider = Object.assign(new MockProvider({}, () => '<message to="discord-test">resumed</message>'), {
    reportsTurnAccounting: true,
  });
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
    await waitFor(done, 3000);
  } finally {
    controller.abort();
    await loop.catch(() => {});
  }
}

beforeEach(() => {
  initTestSessionDb();
  __setConfigForTest(cfg());
});

afterEach(() => {
  __setConfigForTest(null);
  closeSessionDb();
});

describe('a cost decision behind a full window of wake rows', () => {
  it('the first continue lifts the stop, the duplicates are refused, and the queued events resume', async () => {
    seedStoppedWithBacklog();
    const continueRow = { decision: 'continue', epochKey: '0' };
    insertControl('continue-1', 2 * BACKLOG + 2, continueRow);
    insertControl('continue-2', 2 * BACKLOG + 4, continueRow);
    insertControl('continue-3', 2 * BACKLOG + 6, continueRow);

    await runUntil(replied);

    // Exactly one allotment: $300 + $300. The two later copies carry the old
    // epoch 0 against live generation 1 and change nothing.
    const s = H.getState();
    expect(s.costCeilingUsd).toBe(600);
    expect(s.costBudgetGen).toBe(1);
    expect(s.costStopRequested).toBe(false);
    for (const id of ['continue-1', 'continue-2', 'continue-3']) expect(ackStatus(id)).toBe('completed');
    // The resumed turn took the oldest window of events.
    expect(ackStatus('event-1')).toBeDefined();
  });

  it('a set_ceiling request behind the same backlog is applied and resumes the session', async () => {
    seedStoppedWithBacklog();
    insertControl('raise', 2 * BACKLOG + 2, {
      protocolVersion: 2,
      operation: 'set_ceiling',
      adjustmentId: 'cca-behind-window',
      expectedEpochKey: '0',
      expectedCeilingCents: 30000,
      targetCeilingCents: 40000,
    });

    await runUntil(replied);

    const s = H.getState();
    expect(s.costCeilingUsd).toBe(400);
    expect(s.costStopRequested).toBe(false);
    expect(ackStatus('raise')).toBe('completed');
  });
});
